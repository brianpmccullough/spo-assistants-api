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
| [code-style.md](./docs/code-style.md) | NestJS/TypeScript conventions used in this repo |

## Tech stack

NestJS · TypeScript · Microsoft Graph (delegated/OBO) · Azure OpenAI (with an
enterprise-gateway seam) · Server-Sent Events for streaming chat.

## Getting started

No runnable code yet — this repo is currently architecture + planning
(see Status above). Once Phase 0 of the build plan lands, this section will
cover install, environment config, and running the service locally.

## Author

Brian P. McCullough
