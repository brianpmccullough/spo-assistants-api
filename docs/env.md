# Environment Variables

Names and purpose of every environment/secret variable this service reads.
Never record actual secret values here — only what the variable is for and
how to obtain one.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `AZURE_AD_API_CLIENT_ID` | Yes | none | Application (client) ID of the `spo-assistants` EntraID app registration that exposes this API. Used to validate bearer token audience. |
| `AZURE_AD_CLIENT_SECRET` | Yes | none | Client secret for the `spo-assistants` app registration. Used as the confidential-client credential for On-Behalf-Of token exchanges against Microsoft Graph. |
| `AZURE_AD_TENANT_ID` | Yes | none | Directory (tenant) ID that issues and validates tokens for this app registration. Used to build the token issuer and JWKS URLs, and as the OBO authority. |
| `AZURE_OPENAI_API_KEY` | Yes | none | API key for the Azure OpenAI resource. Obtain from the resource's Keys and Endpoint blade. Prefer a managed identity (`azureADTokenProvider`) over a key once the Container App has one assigned. |
| `AZURE_OPENAI_API_VERSION` | No | `2024-10-21` | Azure OpenAI REST API version. Governs which features the deployment exposes; the Responses API in particular is not available on every version. |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | none | Name of the model deployment within the Azure OpenAI resource (the deployment name, not the underlying model name). Used both to route requests and as the model identifier passed to the Agents SDK. |
| `AZURE_OPENAI_ENDPOINT` | Yes | none | Base endpoint of the Azure OpenAI resource, e.g. `https://<resource-name>.openai.azure.com`. |
| `OPENAI_AGENTS_DISABLE_TRACING` | No | none | Disables the Agents SDK's tracing exporter, which otherwise sends prompts and completions to OpenAI's trace endpoint. Defense in depth — `createAzureOpenAiClient` calls `setTracingDisabled(true)`, which is what actually guarantees tracing is off; `docker-publish.yml` sets this to `1` on the Container App so the guarantee survives that call being moved or removed. Never set it to `0`. |
| `CORS_ALLOWED_ORIGINS` | No | `https://localhost:4321` | Comma-separated list of origins allowed to call this API (CORS). Defaults to the local SPFx dev server; set to the tenant's SharePoint domain(s) in deployed environments. |
| `PORT` | No | `3000` | Port the NestJS server listens on. |
