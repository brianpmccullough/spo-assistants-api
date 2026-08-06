# Azure Container Apps Setup

How `spo-assistants-api` is actually deployed today: a manual, one-time setup done
via Azure Cloud Shell. The Container Apps creation wizard in the Azure Portal
could not point at a non-ACR registry (its "Registry" field is a closed dropdown
of registries already connected to the subscription — typing a hostname like
`ghcr.io` produced "No results," with no way to add it as free text). Cloud Shell
(the `>_` icon in the Portal's top nav — no local CLI install required) was used
instead. This doc records the commands that actually worked, so the setup can be
reproduced or torn down without re-deriving them.

**CI/CD status:** redeploying a new image on every push to `main` is now
automated — see `docker-publish.yml`'s `Azure login (OIDC)` and `Deploy to
Azure Container Apps` steps, authenticated via the
`github-actions-spo-assistants-deploy` app registration (federated
credential, no stored secret; **Container Apps Contributor** scoped to
`rg-spo-assistants`). What's still manual, one-time setup (and remains
below) is everything up through *creating* the environment/container app and
its initial env vars/secrets — CI only updates an already-existing app's
image, it doesn't provision one.

Env var names below match [`env.md`](./env.md) — see that doc for what each one
is for and how to obtain a value. Actual secret values are never recorded here.

## Prerequisites specific to this setup

- A free M365 dev tenant cannot create Azure resources; therefore a separate Azure-capable tenant/subscription from the SharePoint/M365 tenant may be required.
- The image published to GHCR by `spo-assistants-api`'s `docker-publish.yml`
  workflow (see [`docker-publish.yml`](../.github/workflows/docker-publish.yml)),
  with the package's GitHub visibility set to **public** (Package settings →
  Change visibility). A public package needs no registry credentials at all;
  Azure Container Apps requires *some* authentication path for non-ACR
  registries otherwise, so public was the low-friction choice for a sample
  project.

## Resource names used

| Resource | Name |
| --- | --- |
| Resource group | `rg-spo-assistants` |
| Region | `swedencentral` |
| Container Apps environment | `env-spo-assistants` |
| Container App | `container-app-spo-assistants` |
| Image | `ghcr.io/brianpmccullough/spo-assistants-api:latest` |

The resource group itself was created via the Portal UI (Resource groups →
Create) before any of the commands below — nothing unusual there, so it isn't
scripted here.

## Setup sequence

Run these in Azure Cloud Shell (bash), signed into the Azure-capable tenant.

### 1. Register required resource providers

A brand-new subscription hasn't registered these yet; `Microsoft.App` gets
auto-registered on first use, but `Microsoft.OperationalInsights` (Log
Analytics, which the Container Apps environment depends on for logging) needs
an explicit, blocking registration first:

```bash
az provider register -n Microsoft.OperationalInsights --wait
```

`--wait` matters — without it the command returns before registration
completes and the next step fails with the same "not registered" error.

### 2. Create the Container Apps environment

```bash
az containerapp env create \
  --name env-spo-assistants \
  --resource-group rg-spo-assistants \
  --location swedencentral
```

No `--logs-destination` was specified, so this auto-creates a Log Analytics
workspace. That's expected and has its own ongoing free tier (5 GB/day
ingestion) — see the cost discussion below.

### 3. Create the Container App

```bash
az containerapp create \
  --name container-app-spo-assistants \
  --resource-group rg-spo-assistants \
  --environment env-spo-assistants \
  --image ghcr.io/brianpmccullough/spo-assistants-api:latest \
  --target-port 3000 --ingress external
```

- `--target-port 3000` matches the Dockerfile's `EXPOSE 3000` and the app's
  `PORT` default in `env.md`.
- `--ingress external` is required since the SPFx Application Customizer calls
  this API from the browser.
- `--min-replicas` was **not** passed, so the created app's scale config shows
  `"minReplicas": null`. Confirmed against [Microsoft's scaling
  docs](https://learn.microsoft.com/en-us/azure/container-apps/scale-app) that
  `null` here just means "using the default," and the default *is* `0` — not
  `1`. With ingress enabled and no custom scale rule, Container Apps applies
  its default HTTP scale rule (min 0 / max 10 replicas) and scales down to
  zero 300 seconds (5 minutes) after the last request. No further action
  needed for scale-to-zero to actually apply here.
- No registry credentials needed — the GHCR package is public.
- **This step alone is not enough to get a working app** — see the next
  section. `az containerapp create` sets no environment variables, and this
  app's `ConfigurationService` fails fast at boot (via `class-validator`) if
  `AZURE_AD_API_CLIENT_ID`, `AZURE_AD_TENANT_ID`, or `AZURE_AD_CLIENT_SECRET`
  are missing. The first deploy crash-looped (`Running status: Failed`, `1/1
  Container crashing`, confirmed via the revision's Basics tab and a `curl`
  that hung until a `504`) until step 4 was applied.

### 4. Set environment variables and secrets

Per [`env.md`](./env.md), `AZURE_AD_CLIENT_SECRET` is a real secret and should
go through Container Apps' secrets store, referenced by the env var rather than
set as a plain value:

```bash
az containerapp secret set \
  --name container-app-spo-assistants \
  --resource-group rg-spo-assistants \
  --secrets azure-ad-client-secret="<AZURE_AD_CLIENT_SECRET value>"

az containerapp update \
  --name container-app-spo-assistants \
  --resource-group rg-spo-assistants \
  --set-env-vars \
    AZURE_AD_API_CLIENT_ID="<AZURE_AD_API_CLIENT_ID value>" \
    AZURE_AD_TENANT_ID="<AZURE_AD_TENANT_ID value — the SharePoint tenant, not necessarily this Azure tenant>" \
    AZURE_AD_CLIENT_SECRET=secretref:azure-ad-client-secret \
    CORS_ALLOWED_ORIGINS="<the SharePoint tenant's domain, e.g. https://mmcbpm.sharepoint.com>"
```

`PORT` isn't set — the app's default of `3000` already matches
`--target-port` above.

## Verifying the deployment

```bash
# From the Container App's Overview page, or:
az containerapp show --name container-app-spo-assistants --resource-group rg-spo-assistants \
  --query properties.configuration.ingress.fqdn -o tsv
```

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://<fqdn>/me"
```

- `401 Missing bearer token` — correct and healthy: the app booted, config
  validation passed, and the auth guard is rejecting unauthenticated requests
  as designed.
- Hanging indefinitely / `504` — the container is crash-looping. Check:

  ```bash
  az containerapp revision list --name container-app-spo-assistants \
    --resource-group rg-spo-assistants -o table
  ```

  and the revision's **Logs** tab in the Portal (Container App → Revisions →
  the revision → Logs) for the actual crash output.

The SPFx Application Customizer's `apiBaseUrl` property points at this FQDN
for a real deployed test instead of `https://localhost:3000` — see
`scripts/script.ps1`'s `-ApiBaseUrl` parameter in `spo-assistants-spfx`.

## Cost

Everything above stays within Azure's ongoing free allowances for a low-traffic
sample project:

- Resource provider registration — free, no resource created.
- Log Analytics workspace — 5 GB/day ingestion free, permanently (not a
  trial); a sample project's console logs won't approach that.
- Container Apps Consumption plan — 180,000 vCPU-seconds, 360,000 GiB-seconds,
  and 2,000,000 requests free per month. Scale-to-zero is confirmed active for
  this deployment (see the `--min-replicas` note above) — idle time costs
  nothing after the 5-minute cool down.

This is also why Azure Container Apps was chosen over AWS App Runner (which
moved to maintenance mode, no new customers as of April 2026) and over
provisioning an Azure Container Registry (~$5/mo minimum even idle) — GHCR is
free and keeps this entirely inside the always-free tier.
