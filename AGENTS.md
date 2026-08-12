# AGENTS.md

Guidance for AI coding agents working in this repo. Read [docs/plans/05-build-plan.md](./docs/plans/05-build-plan.md) first for current state.

There is no architecture-overview or contracts doc. The originals were written before the code existed and described a system that was never built; they were removed on 2026-08-09. Do not reconstruct that architecture from memory, from the SPFx repo, or from git history and treat it as decided — the orchestrator shape, the LLM seam, the tool contract, and the assistant type/instance/resolution model are all genuinely open. Ask rather than assume.

## What this is

NestJS backend for a SharePoint Online AI assistant platform. Companion SPFx client lives in the sibling repo [`spo-assistants-spfx`](https://github.com/brianpmccullough/spo-assistants-spfx); this repo owns all technical documentation for both.

## Non-negotiable rules

- Every default value (config/env defaults, function parameter defaults,
  fallback constants, etc.) is defined in exactly one place. Never re-type or
  copy a default elsewhere — in a test, a mock, a second module, a doc's
  prose — derive it from that one source instead (import it, instantiate the
  class that owns it, read the constant). If you catch yourself writing the
  same literal default in a second spot, that's a signal to refactor, not to
  proceed. Docs may *state* a default for reference, but code must never
  duplicate one.
- Never write a duration as a raw millisecond literal. Express it in the unit a
  human would say it in, using [`Milliseconds`](./src/common/milliseconds.ts) to
  convert: `Milliseconds.fromSeconds(20)`, `Milliseconds.fromMinutes(5)`. A
  sub-second value is still expressed in seconds — `Milliseconds.fromSeconds(0.5)`,
  not `500`. This applies to timeouts, backoff and retry delays, cache TTLs, and
  polling intervals, wherever they live. Add a converter to the helper rather
  than inlining arithmetic if the unit you need is missing.
- Before writing a helper (especially string/data manipulation), search the
  codebase for something that already does it or is close enough to
  generalize. Don't reimplement the same or similar logic in multiple spots.
- When possible, name and shape helpers around what they generically *do*, not the one
  call site that prompted writing them. A function that splits a delimited
  string, trims entries, and drops empties is `parseDelimitedList`, not
  `parseAllowedOrigins` — the narrow name locks it to one caller and invites
  a near-duplicate the next time similar parsing is needed. Prefer parameters
  (e.g. a `delimiter` argument) over hardcoding the one case you have today.

## Coding

See [docs/code-conventions.md](./docs/code-conventions.md) — NestJS/TypeScript code style. Update it in the same PR if you establish a new convention.

## Docs

- All documentation in .md format and stored in /docs.  Any planning documents, which could drift from current state of code, belong in /docs/plans.  Any reference documents that should remain accurate with current state of code, belong in /docs. Use subfolders by feature name.
- Update reference docs in the same PR as the code that changes them — not after.
- There is no decision log. Decisions live in the code, its tests, and commit messages. Don't treat any doc in this repo as binding governance or as a reason to refuse a direction — raise the concern, then follow the user's call.
- If you're unsure whether a change is "just code" or needs a doc update, treat interface, contract, and architecture-shape changes as needing one.
- Any environment variable or secret variable (its name and purpose, never its value) must be documented in [docs/env.md](./docs/env.md).  Variables should be listed alphabetically.
- Reference docs are read by other engineers, not just whoever is in this session. Don't write instructions aimed at the current user (e.g. "from the app registration's Overview page", "as you set up earlier") — state facts that hold for any reader. If a note is genuinely session-specific, say it in chat, don't put it in a doc.

## Validation

- After any editing session:
  - Run formatting to ensure code is consistently formatted.
  - Run lint and address any warnings or issues found.
  - Run tests
