# Environment Variables

Names and purpose of every environment/secret variable this service reads.
Never record actual secret values here — only what the variable is for and
how to obtain one.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `CORS_ALLOWED_ORIGINS` | No | `https://localhost:4321` | Comma-separated list of origins allowed to call this API (CORS). Defaults to the local SPFx dev server; set to the tenant's SharePoint domain(s) in deployed environments. |
| `PORT` | No | `3000` | Port the NestJS server listens on. |
