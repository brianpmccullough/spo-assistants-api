# SharePoint AI Assistant Platform

A context-aware AI assistant surface for SharePoint Online — an SPFx
Application Customizer (SharePoint AI / Knowledge Agent inspired)
backed by a NestJS platform. All data access is delegated
(on-behalf-of the signed-in user), so Microsoft Graph's security trimming is
inherited for free rather than reimplemented.

## Repositories

| Repo | Role |
|---|---|
| [spo-assistants-api](https://github.com/brianpmccullough/spo-assistants-api) | NestJS backend platform — resolution, streaming chat, tool registry. (this repo) |
| [spo-assistants-spfx](https://github.com/brianpmccullough/spo-assistants-spfx) | SPFx Application Customizer — floating chat surface. |

## Docs

Start with the architecture overview — everything else links from there.

| Doc | Purpose |
|---|---|
| [01-architecture-overview.md](./docs/01-architecture-overview.md) | System shape, components, flows. **Read first.** |
| [02-decision-log.md](./docs/02-decision-log.md) | ADRs — the *why* behind each decision, incl. accepted tradeoffs |
| [03-contracts.md](./docs/03-contracts.md) | Load-bearing interfaces: resolution API, `/chat`, tools, attachments |
| [04-extending-the-platform.md](./docs/04-extending-the-platform.md) | Recipes: add an instance / type / tool / page type / MCP exposure |
| [05-build-plan.md](./docs/plans/05-build-plan.md) | Phased roadmap sequenced by risk retirement |
| [code-conventions.md](./docs/code-conventions.md) | NestJS/TypeScript conventions used in this repo |

## Tech stack

NestJS · TypeScript · Microsoft Graph (delegated/OBO) · Azure OpenAI (with an
enterprise-gateway seam) · Server-Sent Events for streaming chat.

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
