# Contracts

The load-bearing interfaces. These are the expensive-to-change surfaces; everything
behind them is swappable. Field lists here are directional — exact shapes finalize
during Phases 1–2 — but the *semantics* documented here are settled.

**Ownership & distribution (ADR-009):** no shared package — each repo
([`spo-assistants-api`](https://github.com/brianpmccullough/spo-assistants-api),
[`spo-assistants-spfx`](https://github.com/brianpmccullough/spo-assistants-spfx))
deliberately duplicates the models it needs. **This document is the arbiter**: when
copies disagree, the doc is right. Contract changes land server-side first and
update this doc in the same PR as the implementing code.

## 1. Assistant resolution API

Graph-style resource model. Sites addressable by Graph site ID or
`hostname:/server-relative-path` (pass-through-friendly to Graph; SPFx
`PageContext` supplies IDs for free).

```
GET  /sites/{siteId}/assistants?pageType=…&listId=…&pageId=…&searchQuery=…
GET  /sites/{siteId}/assistants/{instanceId}
POST /sites/{siteId}/assistants          # future: self-service authoring
```

**Semantics.**
- Query params are the normalized page context. **No context params → site default assistants.**
- Response: applicable instances + which is default for this context. The client
  renders exactly this; it applies no rules of its own.
- Additive evolution: new context params may be introduced at any time; servers
  ignore unknown params, old clients simply send fewer.

**Response shape (directional):**

```ts
{
  assistants: [{
    instanceId: string;
    typeId: string;               // 'site-assistant' | 'people-finder' | ...
    displayName: string;
    description?: string;
    isDefault: boolean;           // for THIS resolved context
    capabilitiesHint?: string[];  // for launcher/switcher UI affordances
  }],
}
```

## 2. Assistant instance record (registry data)

```ts
{
  instanceId: string;
  typeId: string;                 // must exist in code-defined assistant types
  scope: { siteId: string };      // where it is registered
  config: {                       // parameterizes the type — day-1 requirement
    sourceScope?: { listId?: string; folderPath?: string; };
    promptAdditions?: string;
    // type-specific settings
  };
  surfaceRules: {                 // where it APPEARS (≠ what it reads)
    pageTypes?: PageType[];       // e.g. ['searchResults'] for Search Assistant
    // future: audiences, url patterns
  };
  isDefault: boolean;
  enabled: boolean;
}
```

`PageType = 'sitePage' | 'listView' | 'libraryView' | 'searchResults' | 'siteContents' | 'siteSettings' | 'other'`
(produced solely by the client's `PageContextClassifier`; extend deliberately).

## 3. Chat API

```
POST /chat        → SSE stream
```

**Request:**

```ts
{
  assistantInstanceId: string;
  context: {
    siteId: string; webId?: string;
    pageType: PageType;
    pageId?: string; listId?: string; itemId?: string;
    pageUrl?: string; searchQuery?: string;
  };
  messages: { role: 'user' | 'assistant'; content: string }[];  // trimmed window, client-owned
  attachments: Attachment[];                                     // echoed from previous responses
}
```

**SSE event stream:**

| event | payload | purpose |
|---|---|---|
| `delta` | `{ text }` | streamed answer tokens |
| `tool_activity` | `{ toolId, status, label }` | "Searching files…" UX |
| `attachments` | `{ attachments: Attachment[] }` | updated set → client stores + echoes next turn |
| `done` | `{ finishReason }` | terminal |
| `error` | `{ code, message, retryable }` | incl. gateway-busy backpressure |

**Statelessness rule.** The server persists nothing between requests. Everything
needed to continue a conversation is in the request. (If persistence is ever
added per ADR-004 supersession, it is recorded *behind* this contract without
changing it.)

**History budget.** Client sends a trimmed window (N turns / token budget —
tuned in Phase 2). Server may summarize-and-truncate; any summary rides back to
the client and is echoed like ordinary history.

## 4. Attachment protocol

```ts
type Attachment = {
  driveId: string;                // Graph source reference —
  itemId: string;                 //   enables self-healing re-upload
  documentProcessingId: string;   // handle into Document Operations API
  filename: string;
};
```

**Lifecycle.**
1. LLM calls `attach_item` → tool fetches content via Graph (**OBO — access
   checked here**) → uploads to Document Operations API → returns handle.
2. Updated attachment list emitted via the `attachments` SSE event; client
   renders chips, stores, echoes on next request. Detach = client drops it.
3. Summarize/answer tools operate against `documentProcessingId`.
4. TTL (~1 h, extendable) is owned by the document service. On expired-handle
   errors, the tool layer silently re-uploads from `{ driveId, itemId }`.
5. Accepted caveat (ADR-006): access is not re-checked after attach time within
   a conversation.

**Boundary rule.** Small structured content (list item fields, metadata, file
listings) never goes through the document service — it returns as JSON tool
results directly. The document service is for unstructured blobs needing managed
LLM operations.

## 5. Tool contract (internal, but the platform's keystone)

```ts
interface Tool {
  id: string;                                  // 'list_recent_files'
  schema: JSONSchema;                          // what the LLM sees (name, description, params)
  audience?: 'viewer' | 'contentManager';      // omitted = everyone
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;
}

interface ToolContext {
  user: AuthenticatedUser;           // identity + inbound access token, from the validated bearer token
  oboToken: string;                  // Graph-scoped, user identity
  siteContext: ChatRequestContext;   // the request's context object
  attachments: Attachment[];
  instanceConfig: InstanceConfig;    // e.g. sourceScope — HOW one tool serves many instances
}
```

**Rules.**
- Tools are transport-agnostic: no knowledge of chat, SSE, or MCP.
- Tools may be internally complex (multi-step retrieval, sub-LLM calls via
  `LlmClient`, delegation to the Document Operations API). The orchestrator never is.
- `audience` filtering happens at prompt-assembly time against the user's actual
  permissions (Graph-resolved, briefly cached). Unauthorized tools are invisible
  to the LLM, not merely rejected at execution.
- Scoped instances constrain tools via `instanceConfig` (e.g. `search_content`
  restricted to `sourceScope.listId`) — enforced inside the tool, from config,
  never trusted from LLM-supplied input.

## 6. Assistant type definition (code)

```ts
interface AssistantType {
  typeId: string;
  displayName: string;
  model: string;                   // alias; gateway may reinterpret
  systemPrompt: (ctx: PromptContext) => string;   // includes context preamble assembly
  toolIds: string[];               // registry references
  defaultConfig?: InstanceConfig;
}
```

## 7. Environment seam interfaces

```ts
// llm/ — ADR-006. Only module that touches an OpenAI SDK.
interface LlmClient {
  chatStream(req: {
    model: string;
    messages: LlmMessage[];
    tools?: LlmToolSchema[];
  }): AsyncIterable<LlmStreamEvent>;   // deltas | tool_calls | done | throttled
}

// documents/ — ADR-006
interface DocumentOperationsService {
  upload(content: Buffer, filename: string): Promise<{ documentProcessingId: string; expiresAt: string }>;
  summarize(documentProcessingId: string, instructions?: string): Promise<string>;
  answer(documentProcessingId: string, question: string): Promise<string>;
  extendExpiration(documentProcessingId: string): Promise<{ expiresAt: string }>;
}
```

Open contract items with the gateway team (Phase 5 at latest): streaming
passthrough guarantees; 429 semantics (retry-after honored → orchestrator
retries with jitter or emits `error { retryable: true }`).

## 8. MCP exposure (stub — future)

- One MCP endpoint per assistant instance (or per-instance tool namespace),
  EntraID-protected.
- Tool schemas and dispatch come directly from the registry; `instanceConfig`
  scoping applies identically.
- The calling host orchestrates; we execute tools under the caller's delegated
  identity (host must complete an EntraID token acquisition for our API — verify
  feasibility with the host team before committing dates).
- No conversation state shared with the SPFx surface.
