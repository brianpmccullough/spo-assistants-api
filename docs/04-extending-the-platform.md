# Extending the Platform

The platform's thesis is that extension is cheap and follows one pattern. This
doc is the recipe book — and the honesty check: if a future change doesn't fit
one of these recipes, that's a signal to write an ADR, not to improvise.

There are exactly three extension sizes, smallest first:

| You want to… | You build… | Client redeploy? |
| --- | --- | --- |
| Put an existing assistant on another site / scope it differently | An **instance** (data) | No |
| Create a new kind of assistant from existing capabilities | A **type** (small code) | No |
| Add a genuinely new capability | A **tool** (real code) | No |

The only change that touches the SPFx package is a new **page type
classification** (rare — see §4).

---

## 1. Register an assistant instance (data only)

Example: the future self-service scenario — a library-scoped assistant on a
team site, surfaced on the home page, sourcing only from one library.

```jsonc
{
  "instanceId": "contoso-policies-assistant",
  "typeId": "library-assistant",
  "scope": { "siteId": "<site-id>" },
  "config": {
    "sourceScope": { "listId": "<policies-library-id>" },
    "promptAdditions": "You answer questions about Contoso HR policies."
  },
  "surfaceRules": { "pageTypes": ["sitePage"] },
  "isDefault": false,
  "enabled": true
}
```

Notes:

- `sourceScope` (what it reads) and `surfaceRules` (where it appears) are
  independent on purpose.
- Today: platform admins edit the instance store. Later: `POST /sites/{id}/assistants`
  with authoring authorization — same record, new write path.

## 2. Add an assistant type (composition code)

Example: the Search Assistant was mostly this — a new prompt over existing tools.

```ts
// assistants/assistant-types/search-assistant.ts
export const searchAssistant: AssistantType = {
  typeId: 'search-assistant',
  displayName: 'Search Assistant',
  model: 'gpt-4o',
  systemPrompt: (ctx) => searchAssistantPrompt(ctx),  // biases toward narrow/widen-first behavior
  toolIds: [
    'search_content', 'refine_search',                // 1 new tool
    'find_person', 'find_by_expertise',               // reused from people-finder
    'attach_item', 'answer_from_attachments',         // reused from site-assistant
  ],
};
```

Checklist:

1. Write the prompt template (include how the context preamble is used —
   e.g. seed from `context.searchQuery`).
2. Choose a model alias.
3. List tool IDs (build any missing ones — §3).
4. Register the type in the type index.
5. Create at least one instance (§1) with appropriate `surfaceRules`.

If you find yourself wanting to change *how the loop works* for your type —
forced pipelines, custom dispatch — stop: per ADR-005 that complexity belongs
*inside a tool*, or it warrants an ADR for a second orchestration lane.

## 3. Add a tool (capability code)

```ts
// tools/curation/find-stale-content.tool.ts
export const findStaleContent: Tool = {
  id: 'find_stale_content',
  audience: 'contentManager',      // invisible to viewers at prompt-assembly time
  schema: {
    name: 'find_stale_content',
    description: 'Finds pages/documents with low or no views over a period, optionally older than a date.',
    parameters: { /* period, contentTypes, olderThan */ },
  },
  async execute(input, ctx) {
    // 1. Validate/narrow input (LLM-supplied — never trust for authz or scoping)
    // 2. Apply instance scoping from ctx.instanceConfig.sourceScope (config-trusted)
    // 3. Query Graph Search with ViewsLast30Days / ViewsLifeTime managed properties
    //    using ctx.oboToken — results come back security-trimmed
    // 4. Return compact JSON the LLM can reason over
  },
};
```

Rules of the road:

- **Identity:** all data access via `ctx.oboToken`. Never an app identity (ADR-001).
- **Scoping:** from `ctx.instanceConfig`, never from LLM input.
- **Size:** return compact, structured results. If the payload is an unstructured
  blob needing LLM operations, route through `DocumentOperationsService` instead
  (see attachment protocol, [03-contracts.md §4](./03-contracts.md)).
- **Complexity:** multi-step logic inside `execute` is fine (retrieval → rank →
  format; sub-LLM calls via `LlmClient`). That's the sanctioned home for it.
- **Transport-agnostic:** no imports from orchestrator/chat/SSE/MCP modules.
- Register in the `ToolRegistry`; reference by ID from types.
- A tool built for one assistant is automatically available to all — schema
  quality (name/description) matters, because every LLM reads it.

## 4. Add a page type classification (client change — rare)

Only extension requiring SPFx redeployment. Steps:

1. Extend `PageType` union (client + server).
2. Implement detection in `PageContextClassifier` **only** — with tests;
   SPO's URL/PageContext quirks all live here by design.
3. Server: resolution treats unknown/legacy page types as "no special context"
  (graceful degradation), so version skew between deployed bundles and the
  backend is safe.
4. Add `surfaceRules.pageTypes` values on instances that should use it.

## 5. Expose an assistant over MCP (future recipe — sketch)

1. Instance exists (§1) — the registry doubles as the MCP catalog.
2. MCP shim maps the instance's tool set to MCP tool definitions (schemas
   already exist in the registry).
3. Host acquires an EntraID token for our API; tools execute under the caller's
   delegated identity, `instanceConfig` scoping identical.
4. No capability code is written or modified. If it is, something violated ADR-007.

## 6. Worked example: "Expertise Finder" end to end

Goal: on `/sites/expertise`, default assistant lets users locate people by expertise.

| Step | Artifact | Effort |
|---|---|---|
| Tool exists? `find_by_expertise` (people/) | reuse | none |
| Tool exists? `find_person` (people/) | reuse | none |
| Type | `expertise-finder.ts` — prompt + `['find_by_expertise','find_person']` | small |
| Instance | `{ typeId: 'expertise-finder', scope: {siteId: expertise-site}, isDefault: true }` | data |
| Client change | — | none |

That table is the acceptance test for the architecture. If a comparable assistant
ever needs more than this, revisit ADR-005.
