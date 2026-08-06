# Decision Log (ADRs)

Short records of architecturally significant decisions. Format: context → decision →
consequences (including accepted tradeoffs). Newest decisions get appended; superseded
decisions are marked, never deleted.

---

## ADR-001: Delegated (OBO) auth for all data access

**Status:** Accepted

**Context.** The platform reads SharePoint/Graph content (files, pages, people,
usage signals) on behalf of users at 100K+ scale. App-only access would require
us to re-implement permission trimming and creates data-leakage risk.

**Decision.** All Graph/Search calls execute on-behalf-of the signed-in user:
SPFx → API (EntraID bearer via `AadHttpClient`) → OBO exchange → Graph delegated
permissions. No app-only data path.

**Consequences.**

- Security trimming inherited for free; auditing maps to real users.
- Content-manager scenarios needing view counts use **search managed properties**
  (`ViewsLast1Days`, `ViewsLifeTime`, …) instead of app-only reports APIs.
  Accepted tradeoff: these are index-fed and eventually consistent.
- If a future scenario genuinely requires app-only access, it gets a separate,
  explicitly fenced ADR — not a quiet extension.

---

## ADR-002: Assistant type / instance / resolution separation; server-authoritative registry

**Status:** Accepted

**Context.** Assistants must be registerable per site (admin-managed initially,
possibly end-user-authored later, e.g. library-scoped assistants). Baking
registration into the client or conflating "what an assistant is" with "where it
is registered" would pigeonhole us.

**Decision.** Three concepts:

1. **Type** — code-defined capability implementation (prompt, model, tool set).
2. **Instance** — a data record registering a type to a scope with `config`.
3. **Resolution** — server-side rules mapping page context → applicable instances + default.

The client never knows where instances are stored. API modeled Graph-style:
`GET /sites/{siteId}/assistants?…context…`. Instance schema supports
parameterized types from day 1 (`{ typeId, config, surfaceRules, isDefault }`).

**Consequences.**

- Future self-service authoring = a new write path (`POST /sites/{id}/assistants`)
  into the same store; zero client or contract change.
- Instance storage starts as config file behind a store token; swaps to DB when
  authoring arrives.
- **Scope of content ≠ scope of surface**: `config.sourceScope` and
  `surfaceRules` are independent fields (a library-sourced assistant can surface
  on the home page; the Search Assistant surfaces only on `searchResults`).

---

## ADR-003: Client classifies page context; server resolves applicability

**Status:** Accepted

**Context.** Only the SPFx client can reliably classify "search results page vs.
library view vs. site page" (it has `PageContext`, URLs, list IDs). But
client-resident rules would require app-catalog redeployments to change behavior.

**Decision.** The client sends a normalized context object
(`{ siteId, pageType, listId?, pageId?, searchQuery?, … }`) and renders whatever
the server resolves. All applicability rules live server-side as instance data.
No context sent → site default assistants.

**Consequences.**

- New scoping rules and assistant types ship without SPFx redeployment.
- The client owns exactly one logic module: `PageContextClassifier`, isolated and
  well-tested, where SPO's page-detection quirks (classic vs. modern,
  `AllItems.aspx`, search page variants) concentrate.
- Contract degrades gracefully; new context fields are additive.

---

## ADR-004: Ephemeral, client-owned conversation state

**Status:** Accepted

**Context.** Persisted conversations add a store, retention policy, and state
management. Scale pressure is on the LLM, not on our nodes; no current audit
requirement mandates server-side transcripts.

**Decision.** Chat history and the attachment list are client-held and ride in
each `/chat` request (trimmed window / token budget). Backend is stateless.
Navigation tears down the chat in v1.

**Consequences.**
- Stateless horizontal scaling; no session affinity.
- Cross-device resume and "yesterday's chat" are out of scope for v1.
- sessionStorage transcript revival is a cheap v1.1 enhancement (state is already
  serializable client-side).
- If audit/compliance requirements emerge, persistence is added *behind* the same
  `/chat` contract (server records what flows through it) — supersede this ADR then.

---

## ADR-005: Single orchestrator; tools are the extension point

**Status:** Accepted

**Context.** Assistant types (Site, People, Expertise, Search, future
library-scoped) risk each growing bespoke orchestration. Evidence against that:
the Search Assistant's capability list is mostly a re-composition of Site
Assistant + People Finder capabilities.

**Decision.** One LLM loop (assemble prompt → call model with tool schemas →
dispatch → repeat → stream) serves all assistants. An assistant type is data:
`{ systemPrompt, model, toolIds[], defaultConfig }`. Capabilities are typed tools
in a registry; tool `audience` (`viewer` | `contentManager`) filters what the LLM
sees per request based on the user's actual permissions.

**Consequences.**
- "Build a new assistant" ≈ write missing tools + a type definition + register instances.
- Pipeline-ish complexity is allowed *inside* a tool (e.g. a tool that internally
  does multi-step retrieval) — never as a fork of the orchestrator.
- Decision test for the future: if an assistant cannot be expressed as
  (prompt, model, toolset, scope), that triggers a new ADR for a second lane —
  not an in-place hack.

---

## ADR-006: Environment seams behind injection tokens (`LlmClient`, `DocumentOperationsService`)

**Status:** Accepted

**Context.** The reference build uses Azure OpenAI directly and a local document
operations implementation. The production environment uses (a) an enterprise LLM
gateway wrapper (auto-scaling, throttling, routing) speaking the Azure OpenAI API
shape, and (b) an existing document-operations API (upload ≤ ~10 MB, content
stays in that layer, LLM operations against it, ~1 h TTL, extendable, service-owned cleanup).

**Decision.** Exactly two NestJS injection tokens abstract the environment:
- `LlmClient` — Azure OpenAI SDK impl ↔ gateway impl. No other module imports the
  OpenAI SDK. Model names are aliases the gateway may reinterpret.
- `DocumentOperationsService` — `upload → documentProcessingId`,
  `summarize(id, …)`, `answer(id, question)`, `extendExpiration(id)`.

**Consequences.**
- Reference ↔ production is a configuration difference, not a code fork.
- Contract items to confirm with the gateway team: SSE/streaming passthrough,
  429/backpressure semantics.
- Attachment authz caveat, accepted: access is checked at attach time (OBO);
  operations then run against the uploaded copy. Revocation mid-conversation is
  not re-checked. Short TTL bounds exposure. Documented, not designed around.
- Expired handles self-heal: attachments carry `{ driveId, itemId }`, enabling
  silent re-upload in the tool layer.

---

## ADR-007: Capabilities are transport-agnostic; chat and MCP are adapters

**Status:** Accepted

**Context.** Site assistants may later be exposed via MCP to enterprise AI hosts
(internal "Claude Web" / "ChatGPT Web" style tools), where the *host's* LLM
orchestrates.

**Decision.** No capability logic lives in the chat controller or prompt
handling. Tools (typed, scoped, OBO-aware) are the unit of reuse. MCP exposure is
a thin shim: tool schemas + dispatch over the existing registry, per-instance
namespaces, EntraID-protected.

**Consequences.**
- MCP requires no capability reimplementation.
- Prerequisite to verify with the enterprise host team: the host can acquire an
  EntraID token for our API (its own OBO chain) so delegated access is preserved.
- Conversation state is *not* shared between transports (consistent with ADR-004).

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
- v1 navigation behavior: chat dismisses on navigation (see ADR-004).

---

## ADR-009: Separate repositories; server-owned contracts with a published-types path

**Status:** Accepted

**Context.** The solution has two deployables with incompatible toolchains: the
SPFx package (rigid build chain — pinned Node versions per SPFx release,
gulp/webpack machinery historically hostile to workspace hoisting and pnpm
symlink layouts) and the NestJS API (modern Node, Docker). A monorepo was
considered; keeping SPFx buildable inside one required enough caveats (no
workspace tooling, isolated installs, copy steps for shared types) that it
became a monorepo in name only. The real monorepo benefit — contract drift
prevention — must therefore be solved another way.

**Decision.** Two repositories:

- [`spo-assistants-api`](https://github.com/brianpmccullough/spo-assistants-api) —
  NestJS platform. Home of `/docs` (this document set), including the
  authoritative contracts doc.
- [`spo-assistants-spfx`](https://github.com/brianpmccullough/spo-assistants-spfx) —
  SPFx Application Customizer. Deliberately thin client.

Contract strategy: **deliberate duplication, no shared package.** Each repo
defines its own copies of the shared models (`PageType`, `Attachment`,
chat/resolution shapes). [03-contracts.md](./03-contracts.md) is the arbiter —
when copies disagree, the doc is right, and contract changes update the doc in
the same PR as the server-side implementation. (Options considered and
deferred: published types-only package, OpenAPI-generated client types —
revisit if the model surface or the number of consumers grows.)

**Consequences.**
- Each repo keeps a boring, native toolchain (own lockfile, own `.nvmrc`, own CI).
- Drift risk is accepted, bounded by two things: doc 03 as the single written
  contract, and *runtime* tolerance by design (ADR-003 graceful degradation:
  unknown fields ignored, unknown `pageType` → defaults) — which was the real
  safety net regardless of packaging, monorepo included.
- **Documentation ownership:** the API repo's `/docs` owns the technical
  documentation, full stop — architecture, ADRs, contracts, extension recipes,
  build plan, and any client-side notes worth keeping (e.g.
  `PageContextClassifier` quirks). The SPFx repo carries only its README:
  a pointer to the API `/docs` plus the usual inline build/run steps. No
  parallel doc set, nothing replicated.
- Revisit trigger: a second API consumer, separate owning teams, or access
  boundaries — none true today.

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
  since none of it is scripted or repeatable via `az containerapp create`
  alone.
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
