# AGENTS.md

Guidance for AI coding agents working in this repo. Read [docs/01-architecture-overview.md](./docs/01-architecture-overview.md) first — this file is a distillation, not a replacement.

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
- Keep the ADR log append-only.  It's OK to change a decision, but keep the original decision logged, followed by the change logged separately.
- If you're unsure whether a change is "just code" or needs a doc update, treat interface, contract, and architecture-shape changes as needing one.
- Any environment variable or secret variable (its name and purpose, never its value) must be documented in [docs/env.md](./docs/env.md).  Variables should be listed alphabetically.

## Validation

- After any editing session:
  - Run formatting to ensure code is consistently formatted.
  - Run lint and address any warnings or issues found.
  - Run tests
