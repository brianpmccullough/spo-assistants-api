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
- No abbreviations in identifiers (variables, functions, classes, files) unless
  it's a very well-known abbreviation for a coding concept (`Api`, `Http`, `Url`, `Id`) or a typical convention for this NestJS framework. Spell it out otherwise — `configuration` not `config`, `message` not `msg`.
- Use single quotes for strings, including imports.

### Strings and regular expressions

- Prefer explicit string and platform APIs over regular expressions:
  `startsWith`/`endsWith`, `slice`, `replaceAll`, `split` with a literal
  delimiter, `URL`, and a small parser expressed in ordinary control flow.
  Do not use a regex for fixed prefixes, suffixes, delimiters, or exact tokens.
- Use a regular expression only when the rule is inherently pattern-based and
  cannot be expressed clearly with those APIs. Keep it local, make it as small
  as possible, and add a short comment that describes the rule in plain language
  when the pattern is not immediately obvious. Prefer a named parser when the
  same pattern or a closely related one is needed more than once.


## NestJS structure

- One module per top-level directory under `src/`. A module owns its providers,
  controllers, and internal types; only what's exported from the module's
  `index.ts` (or explicit public surface) is used by others. Existing modules:
  `auth/`, `graph/`, `configuration/`, `users/`, `assistants/`, `common/`. The
  module set beyond these is not predetermined — an earlier doc listed
  `orchestrator/`, `tools/`, `llm/`, and `documents/` as a planned layout, but
  none exist and that decomposition is not settled.
- `common/` holds small, dependency-free helpers with no home in a specific
  module (e.g. `Milliseconds`). Not a dumping ground — most code belongs in
  its owning module.
- Constructor-based dependency injection only. No property injection, no
  service locator patterns.
- Where an external environment-specific dependency is abstracted, do it with an
  `InjectionToken` plus an interface defined in the consuming module, bound to a
  concrete implementation in that module's provider config; a feature module then
  never imports a concrete implementation directly. This is a style rule for how
  to build such a seam, not a standing decision that any particular seam exists.
- Agents SDK function tools are lightweight injectable descriptors: define the
  model-visible schema, collect validated parameters and the run context, then
  delegate to a NestJS service. Keep Graph calls, OBO token exchange, response
  mapping, and business rules in that service; do not embed them in the tool
  descriptor. Put assistant tool descriptors in `assistants/tools/`. See ADR-011.
- Put client/server DTOs and typed contracts at service boundaries in the owning
  feature's `models/` folder (for example, `assistants/models/` or
  `graph/models/`); keep their tests colocated there.
- Controllers stay thin: validate/transform input (model class + `class-validator`),
  delegate to a service, map the result to an HTTP/SSE response. No business
  logic in controllers.
- Guards own bearer-token validation and user-context extraction
  (`auth/`); don't re-check auth inside services.
- `MicrosoftBearerTokenGuard` is registered globally (`APP_GUARD` in
  `AuthModule`) — routes require a valid bearer token by default. Opt a route
  out with `@Unauthenticated()` (`auth/unauthenticated.decorator.ts`); don't add per-route
  `@UseGuards(MicrosoftBearerTokenGuard)`, it's redundant.

## File naming

- Standard NestJS convention: kebab-case + a dot-separated type suffix
  matching the file's role, per `@nestjs/cli`'s schematics and the official
  docs/sample apps (`cats.controller.ts`, `cats.service.ts`,
  `create-cat.dto.ts`). Domain concepts without a built-in Nest suffix follow
  the same pattern (`find-stale-content.tool.ts`). The class/type/interface
  inside the file is still PascalCase (`CatsController`,
  `FindStaleContentTool`).
- No `Model` suffix on request/response model classes — the bare noun is the
  name (`Attachment`, `ChatRequest`, `ChatResponse`), not `AttachmentModel`.
- Inbound and outbound shapes are separate types even when they look alike.
  Inbound is a class carrying `class-validator` decorators (`ChatMessage`);
  outbound is a plain `readonly` interface (`ChatMessage`), since server-produced
  values need no validation. Sharing one class conflates two contracts — it
  advertises server-only fields as client-settable and forces one set of
  constraints onto both directions.
- One primary export per file; file name is the kebab-case form of the
  primary export plus its type suffix.
- Test files colocated as `*.spec.ts` next to the file under test
  (`cats.controller.spec.ts`).

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
- Mock at the boundary to an external service (Microsoft Graph, the LLM
  provider) — never mock the module under test itself.
- Prefer testing units that need no DI as plain functions, without booting a
  testing module.
