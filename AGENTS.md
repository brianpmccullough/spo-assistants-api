# AGENTS.md

Guidance for AI coding agents working in this repo. Read [docs/01-architecture-overview.md](./docs/01-architecture-overview.md) first — this file is a distillation, not a replacement.

## What this is

NestJS backend for a SharePoint Online AI assistant platform. Companion SPFx client lives in the sibling repo [`spo-assistants-spfx`](https://github.com/brianpmccullough/spo-assistants-spfx); this repo owns all technical documentation for both.

## Non-negotiable rules

None at this time.

## Coding

See [docs/code-conventions.md](./docs/code-conventions.md) — NestJS/TypeScript code style. Update it in the same PR if you establish a new convention.

## Docs

- All documentation in .md format and stored in /docs.  Any planning documents, which could drift from current state of code, belong in /docs/plans.  Any reference documents that should remain accurate with current state of code, belong in /docs. Use subfolders by feature name.
- Update reference docs in the same PR as the code that changes them — not after.
- Keep the ADR log append-only.  It's OK to change a decision, but keep the original decision logged, followed by the change logged separately.
- If you're unsure whether a change is "just code" or needs a doc update, treat interface, contract, and architecture-shape changes as needing one.

## Validation

- After any editing session:
  - Run formatting to ensure code is consistently formatted.
  - Run lint and address any warnings or issues found.
  - Run tests
