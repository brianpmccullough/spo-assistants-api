# Decision Log (ADRs)

Short records of architecturally significant decisions. Format: context → decision →
consequences (including accepted tradeoffs). Newest decisions get appended; superseded
decisions are marked, never deleted.

**2026-08-09 reset.** ADR-002 through ADR-007 and ADR-009 were deleted, not marked
superseded. All were written up front in the repo's initial commit, before the code
they described existed, and none were ever implemented — keeping them would have let
unvalidated guesses read as settled architecture. What remains is only what running
code backs. The numbering gaps are intentional and numbers are not reused; the
originals are in git history at `02a3bd7`. The append-only rule applies from here.

---

## ADR-001: Delegated (OBO) auth for all data access

**Status:** Accepted

**Context.** The platform reads SharePoint/Graph content (files, pages, people,
usage signals) on behalf of users at 100K+ scale. App-only access would require
us to re-implement permission trimming and creates data-leakage risk.

**Decision.** All Graph, Search, and SharePoint REST calls execute on-behalf-of the signed-in user:
SPFx → API (EntraID bearer via `AadHttpClient`) → OBO exchange → Graph delegated
permissions. No app-only data path.

**Consequences.**

- Security trimming inherited for free; auditing maps to real users.
- Content-manager scenarios needing view counts use **search managed properties**
  (`viewsLast1Days`, `viewsLifetime`, …) instead of app-only reports APIs.
  Accepted tradeoff: these are index-fed and eventually consistent.
- If a future scenario genuinely requires app-only access, it gets a separate,
  explicitly fenced ADR — not a quiet extension.

---

## ADR-008: Floating anchored chat surface, not `<Panel>`

**Status:** Accepted

**Context.** SPFx Application Customizers are not limited to Fluent `<Panel>`;
placeholders/portals can render arbitrary React DOM. `<Panel>` is modal-ish
(overlay, light-dismiss, focus trap) and blocks page interaction — contrary to
the Knowledge Agent-style experience we're emulating.

**Decision.** Bottom-right launcher → floating anchored chat card that does not
block the page. User can scroll/read/interact while chatting.

**Consequences.**
- We own z-index/positioning hygiene against SPO chrome and coexistence with
  SPO's native corner UI (Copilot/feedback buttons). Contained in one component.
- v1 navigation behavior: chat dismisses on navigation. This was safe to accept
  because conversation state is client-held rather than server-persisted, so a
  torn-down chat loses nothing the server was tracking. That state model is no
  longer a recorded decision — re-settle it before relying on this consequence.

**Open question (to revisit):** now that a real chat surface is built
(`components/chat/`), whether a custom-built anchored card is worth the
ongoing maintenance versus Fluent's `<Panel>` (e.g. `type={PanelType.custom}`
with `customWidth`, which can be made non-blocking-ish via `isBlocking={false}`
and `isLightDismiss`). Deliberately unresolved — the reasoning above (avoid
modal/focus-trap behavior) still holds, but hasn't been re-checked against
what `<Panel>`'s newer configuration options actually allow. Not re-litigating
now; revisit before this leaves prototype status.

---

## ADR-010: Azure Container Apps + GHCR for hosting; manual Cloud Shell setup

**Status:** Accepted

**Context.** This is a sample project: real running infrastructure is valuable
for proving the auth chain end-to-end, but must cost effectively nothing.
AWS App Runner (the original candidate, from prior project experience) closed
to new customers April 30, 2026 and moved to maintenance mode, ruling it out.
A registry is also required to host the API's Docker image; Azure Container
Registry's cheapest tier runs ~$5/mo even idle, which is real money for a
sample project's registry alone.

**Decision.**
- **Hosting:** Azure Container Apps, Consumption plan. Chosen for its ongoing
  (not trial) free monthly allowance — 180,000 vCPU-seconds, 360,000
  GiB-seconds, 2,000,000 requests — combined with scale-to-zero, which is the
  *default* behavior (`minReplicas` defaults to 0; no explicit config
  required) when ingress is enabled and no custom scale rule is defined.
  Confirmed empirically post-deploy: replica count drops to 0 after ~5 minutes
  idle, cold-starts (`Activating` → `Running`) on the next request.
- **Registry:** GitHub Container Registry (`ghcr.io`), package visibility set
  to public. Free, and CI already authenticates to it with the repo's own
  `GITHUB_TOKEN` (no PAT to provision or rotate) to push on every merge to
  main — see `docker-publish.yml`. Public visibility adds no exposure beyond
  what the already-public source repo provides, and removes the need for any
  registry credential at deploy time.
- **Deployment mechanism:** Azure Cloud Shell (browser-based, pre-authenticated
  `az` CLI), not the Portal's guided Container App creation wizard. The
  wizard's "Registry" field is a closed dropdown of registries already
  connected to the subscription — typing `ghcr.io` returns "No results," with
  no free-text path to a non-ACR registry. Cloud Shell avoids both that dead
  end and a local CLI install (previously abandoned as too slow to set up on
  this machine).
- **Tenant split:** the Azure subscription hosting these resources is a
  separate tenant from the SharePoint/M365 dev tenant (the latter cannot
  create Azure resources at all). This is fine because hosting tenant and
  token-issuing tenant are independent axes — `AZURE_AD_TENANT_ID` and the
  Entra app registrations still point at the SharePoint tenant regardless of
  which subscription pays for compute.

**Consequences.**
- The full working command sequence — provider registration, environment
  creation, container app creation, env var/secret wiring, and the
  crash-loop-from-missing-env-vars symptom this project actually hit — is
  recorded in
  [`azure-container-services-setup.md`](./azure-container-services-setup.md),
  since none of it is repeatable via `az containerapp create` alone. Env var and
  secret wiring is no longer manual — `docker-publish.yml` applies it on every
  push from repository variables and secrets, so the repo is the source of truth
  and a portal edit is overwritten on the next deploy. The commands stay in that
  doc for first-time setup and environment recovery.
- **Deployment is now automated.** `docker-publish.yml` builds, pushes to
  GHCR, then (push-only) deploys the exact just-published image — via a
  dedicated `github-actions-spo-assistants-deploy` app registration,
  OIDC federated credential (`repo:.../spo-assistants-api:ref:refs/heads/main`,
  no stored secret), and a **Container Apps Contributor** role assignment
  scoped to `rg-spo-assistants` only. `az containerapp update` pins the
  deploy to the run's own `sha-<shortsha>` tag, not floating `latest`.
- Revisit trigger: real (non-sample) traffic that risks exceeding the
  Consumption plan's free allowance, or a requirement that rules out
  GHCR's public visibility.

---

## ADR-011: Native Agents SDK function tools with NestJS operation services

**Status:** Accepted

**Context.** Phase 1 needs a real tool-call loop and a first security-trimmed
Graph capability. A hand-rolled tool registry would duplicate the loop already
provided by the chosen Agents SDK, but allowing the SDK descriptors to contain
Graph access would make the data-access operations hard to reuse or test.

**Decision.** Use the Agents SDK's native function-tool mechanism for tool
schemas, argument collection, dispatch, and the model continuation loop. A
tool is a lightweight injectable descriptor that obtains only the current
execution context and delegates its operation to a NestJS service. The NestJS
service owns OBO token exchange, Graph client creation, Graph calls, response
mapping, and tests.

**Consequences.**

- `list_recent_files` has no user-settable parameters. `get_popular_content`
  optionally accepts either sortable view-count managed property; it defaults to
  `viewsRecent` (the previous 14 days) and also supports `viewsLifetime`. Both
  tools pass the authenticated user's access token and current site to their
  Graph operation services and return compact document and site-page result lists
  to the model. Search scopes are restricted to `driveItem` documents and
  `listItem` site pages; other list-item types are excluded.
- `find_stale_content` has no user-settable parameters. It finds the same
  document and site-page scope where `lastModifiedTimeForRetention` is at least
  two years old and `viewsLifetime` is either zero or absent.
- `get_page_content` accepts an optional page URL; when omitted, it
  uses the current page URL from the execution context. It calls the SharePoint
  REST `ListItemAllFields` endpoint to return that page's `CanvasContent1` field.
- The SDK is the current LLM-loop seam, while Graph operations stay ordinary
  NestJS dependencies reusable by a future registry, MCP adapter, or non-LLM
  endpoint.
- Do not introduce a general registry until more than one execution surface
  creates a concrete shared requirement.
