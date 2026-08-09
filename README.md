# SharePoint AI Assistant Platform

A context-aware AI assistant surface for SharePoint Online — an SPFx
Application Customizer (SharePoint AI / Knowledge Agent inspired)
backed by a NestJS platform. All data access is delegated
(on-behalf-of the signed-in user), so Microsoft Graph's security trimming is
inherited for free rather than reimplemented.

## Repositories

| Repo | Role |
|---|---|
| [spo-assistants-api](https://github.com/brianpmccullough/spo-assistants-api) | NestJS backend platform — bearer validation, OBO exchange to Graph, chat endpoint. (this repo) |
| [spo-assistants-spfx](https://github.com/brianpmccullough/spo-assistants-spfx) | SPFx Application Customizer — floating chat surface. |

## Docs

| Doc | Purpose |
|---|---|
| [02-decision-log.md](./docs/02-decision-log.md) | ADRs — the *why* behind each decision, incl. accepted tradeoffs |
| [05-build-plan.md](./docs/plans/05-build-plan.md) | Phased roadmap sequenced by risk retirement |
| [code-conventions.md](./docs/code-conventions.md) | NestJS/TypeScript conventions used in this repo |
| [env.md](./docs/env.md) | Environment/secret variables |

There is deliberately no architecture-overview, contracts, or extension-recipes
doc right now. An earlier set (written before the code existed) described an
orchestrator, tool registry, assistant type/instance/resolution model, and a
streaming `/chat` contract that were never built, and was removed on 2026-08-09
rather than left standing as pseudo-authority. Those areas are open and will be
re-documented from working code. Recover the originals from git history if a
specific detail is wanted: `git show 02a3bd7:docs/03-contracts.md`.

## Tech stack

NestJS · TypeScript · Microsoft Graph (delegated/OBO) · Azure OpenAI (target;
not yet wired). Chat currently posts full conversation history per request;
streaming transport is deferred, not decided.

## Getting started

Requires Node 24 (see `.nvmrc`) and npm.

```bash
npm install
npm run start:dev   # runs on http://localhost:3000
npm run test        # unit tests
npm run lint        # eslint
```

## Author

Brian P. McCullough
