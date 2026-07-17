# Code Style

Conventions for this NestJS + TypeScript codebase. Where this doc is silent,
follow idiomatic NestJS; don't invent local conventions without updating this
doc in the same PR.

## TypeScript

- `strict: true` (all strict flags on). No `any` — use `unknown` and narrow,
  or a proper type. If a genuine escape hatch is needed, `// eslint-disable-next-line`
  with a one-line reason, not a blanket suppression.
- No non-null assertions (`!`) except where a NestJS lifecycle guarantee makes
  the value provably defined (e.g. after a guard has run) — comment why.
- Where interface is used to define a shape of an object, no "I" prefix needed.
- Where interface is used to define a contract, use the "I" prefix
- Prefer enums over string unions.  These are more readable and don't appear as "magic strings" throughout the code.
- Explicit return types on all exported functions and class methods. Inference
  is fine for local/private helpers.
- Named exports only. No `export default` — keeps refactors and registry wiring (tool/type registration) grep-able.
- No use of `any`. Prefer a specific type.  If a type cannot be used, use `unknown`.  `any` is ONLY acceptable in APIs or libraries that are outside the control of this code.
- 

## NestJS structure

- One module per top-level directory under `src/` (`assistants/`, `orchestrator/`,
  `tools/`, `graph/`, `llm/`, `documents/`, `auth/` — see
  [01-architecture-overview.md §4](./01-architecture-overview.md)). A module
  owns its providers, controllers, and internal types; only what's exported
  from the module's `index.ts` (or explicit public surface) is used by others.
- Constructor-based dependency injection only. No property injection, no
  service locator patterns.
- Environment seams (`LlmClient`, `DocumentOperationsService`) are
  `InjectionToken`s with interfaces defined in the consuming module, bound to
  concrete implementations in that module's provider config (ADR-006). A
  feature module never imports a concrete implementation directly — only the
  token and its interface.
- Tools are plain objects implementing `Tool` (see
  [03-contracts.md §5](./03-contracts.md)), registered into `ToolRegistry` —
  not NestJS providers themselves unless a tool genuinely needs DI (e.g. a
  tool that calls `LlmClient` internally), in which case inject via a small
  factory, not a full `@Injectable()` service masquerading as a tool.
- Controllers stay thin: validate/transform input (model class + `class-validator`),
  delegate to a service, map the result to an HTTP/SSE response. No business
  logic in controllers.
- Guards own bearer-token validation and user-context extraction
  (`auth/`); don't re-check auth inside services.

## File naming

- PascalCase filenames matching the primary export, .NET-style, MUST match the name of the class, type, interface contained within the file.
  `ChatModule.ts`, `ListRecentFilesTool.ts`, `Attachment.ts`, `ICallable`.
- No `Model` suffix on request/response model classes — the bare noun is the
  name (`Attachment`, `ChatRequest`, `ChatResponse`), not `AttachmentModel`.
- One primary export per file; file name matches the primary export exactly
  (`FindStaleContentTool` → `FindStaleContentTool.ts`).
- Test files colocated as `*.spec.ts` next to the file under test
  (`ChatController.spec.ts`).

## Errors


## Security

- Any Microsoft Graph API calls should default to obo.
- Logging of any PII is not allowed.

## Formatting & linting

- ESLint + Prettier, enforced in CI and via a pre-commit hook — don't hand-format
  against the grain of the configured rules.
- Prettier defaults except: single quotes, trailing commas (`all`), 100-char
  print width.
- Import order enforced by ESLint (`eslint-plugin-import`): Node builtins →
  external packages → internal absolute (`src/...`) → relative. No manual
  reordering wars — let the linter sort it.

## Testing

- `*.spec.ts` unit tests colocated with source; NestJS `Test.createTestingModule`
  for anything exercising DI.
- Tools are tested as pure functions against a constructed `ToolContext` —
  no need to boot a testing module for tool-only tests.
- Mock at the seam boundaries (`LlmClient`, `DocumentOperationsService`,
  Graph client) — never mock the module under test itself.
