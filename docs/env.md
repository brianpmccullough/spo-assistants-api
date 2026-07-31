# Environment Variables

Names and purpose of every environment/secret variable this service reads.
Never record actual secret values here — only what the variable is for and
how to obtain one.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `AZURE_AD_API_CLIENT_ID` | Yes | none | Application (client) ID of the `spo-assistants` EntraID app registration that exposes this API. Used to validate bearer token audience. |
| `AZURE_AD_CLIENT_SECRET` | Yes | none | Client secret for the `spo-assistants` app registration. Used as the confidential-client credential for On-Behalf-Of token exchanges against Microsoft Graph. |
| `AZURE_AD_TENANT_ID` | Yes | none | Directory (tenant) ID that issues and validates tokens for this app registration. Used to build the token issuer and JWKS URLs, and as the OBO authority. |
| `CORS_ALLOWED_ORIGINS` | No | `https://localhost:4321` | Comma-separated list of origins allowed to call this API (CORS). Defaults to the local SPFx dev server; set to the tenant's SharePoint domain(s) in deployed environments. |
| `PORT` | No | `3000` | Port the NestJS server listens on. |
