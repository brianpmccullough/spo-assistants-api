# Environment-Driven Configuration: Options

**Status: open question. Nothing here is decided.**

Captured 2026-08-19 while adding an Azure OpenAI client log level that should be
`debug` locally and quiet elsewhere. The immediate need is one setting, but the
shape chosen will be the backbone for any later per-environment pivot, so the
options are recorded here rather than settled by whichever was fastest to type.

Three candidate shapes:

1. **`NODE_ENV`** as the environment discriminator.
2. **`APP_ENV`** (a private variable) as the discriminator, `NODE_ENV` left to tooling.
3. **Per-setting config** — no discriminator at all; every knob is its own variable.

---

## Verified behaviour in this repo's dependency tree

Findings read from installed sources, not documentation. Worth re-checking after
major dependency bumps, since all of it is third-party internals.

| Package | Location | Behaviour |
| --- | --- | --- |
| `jest-cli` | `bin/jest.js:12-13` | Sets `process.env.NODE_ENV = 'test'` when it is unset. Does not override an existing value. |
| `@openai/agents-core` | `dist/config.js:119` | Disables tracing when `NODE_ENV === 'test'`. Exact match on a non-production value. |
| `express` | `lib/application.js:91,138` | Defaults `env` to `'development'` when `NODE_ENV` is unset; enables view cache only when `NODE_ENV === 'production'`. |
| `finalhandler` | `index.js:160` | When `env !== 'production'`, sends `err.stack` in the response body. |
| `openai` (7.4.0) | `client.d.ts:131`, `client.js:172` | Accepts `logLevel?: LogLevel` where `LogLevel = 'off' \| 'error' \| 'warn' \| 'info' \| 'debug'`; also reads the `OPENAI_LOG` environment variable on its own. |

Two consequences worth noting up front:

- The `@openai/agents-core` behaviour means `NODE_ENV=test` disables Agents SDK
  tracing for free under Jest. This is independent of which option is chosen —
  Jest sets `NODE_ENV=test` regardless — so it is not an argument for option 1.
  See `OPENAI_AGENTS_DISABLE_TRACING` in [env.md](./env.md) for the deployed-environment
  guarantee, which does not depend on this.
- The `finalhandler` behaviour is the concrete cost of a non-`production`
  `NODE_ENV` in a deployed environment: stack traces in HTTP responses. In a Nest
  app the blast radius is limited, because Nest's exception filter handles errors
  before `finalhandler` sees them — it applies to requests that escape Nest entirely.

---

## Option 1 — `NODE_ENV` as the discriminator

Values `development | test | production`, defaulting to `development` (which is
what an unset variable means, so `nest start --watch` needs no change).

**For**

- One variable. Nothing new for a developer to learn or remember.
- Already set correctly in some contexts without any effort: Jest sets `test`,
  most deployment platforms set `production`.
- Third-party packages that branch on it get sensible values automatically,
  rather than seeing an unset variable.
- For the three-value set specifically, nothing in the current dependency tree
  misbehaves. This was checked, not assumed.

**Against**

- Contradicted directly by the Node.js documentation, which states that "setting
  `NODE_ENV` to anything but `production` is considered an *antipattern*" and
  recommends running with `NODE_ENV=production` in every deployed environment.
- Overloaded. The variable is simultaneously read by the test runner, build
  tooling, and third-party libraries; app-level meaning is layered on top of
  uses that are not ours to control.
- Does not extend. A fourth value (`staging`) is where it breaks: `express` and
  `finalhandler` treat any non-`production` value as development, so a staging
  deploy would lose production behaviour and serve stack traces. The escape hatch
  at that point — `NODE_ENV=production` with a separate variable naming the real
  environment — is option 2, arrived at later and with more to unpick.
- `NODE_ENV=test` under Jest means the app's environment identity is set by the
  test runner, which is convenient until a test needs to exercise
  production-shaped configuration.

---

## Option 2 — `APP_ENV` as the discriminator

A private variable with whatever values this project wants. `NODE_ENV` is left
to tooling and pinned to `production` in all deployed environments.

**For**

- The two concerns are separated: `NODE_ENV` keeps its ecosystem meaning,
  `APP_ENV` carries deployment identity. Neither constrains the other.
- Values are ours. `staging`, `sandbox`, or a per-tenant environment can be added
  without consulting how third-party packages interpret the string.
- Consistent with the Node.js guidance above and with the recommendation in the
  external write-ups (reserve `NODE_ENV` for tooling, add a separate variable).
- Avoids the staging trap by construction rather than by remembering to avoid it.

**Against**

- Two variables where one might do, and a standing requirement to set
  `NODE_ENV=production` in deployment configuration — a step that is easy to omit
  and silent when omitted.
- No framework support. NestJS does not have an `IHostEnvironment` equivalent, so
  this is bespoke either way; `APP_ENV` is bespoke *and* non-standard-looking to
  a newcomer who expects `NODE_ENV`.
- Speculative today. The staging scenario it protects against does not currently
  exist, and may never.
- Does not by itself address the deeper objection in option 3 — it is still a
  named environment group.

---

## Option 3 — Per-setting config, no discriminator

No environment concept. Each behaviour gets its own variable
(`AZURE_OPENAI_LOG_LEVEL`, etc.), set explicitly wherever it should differ.

**For**

- This is what the Twelve-Factor App recommends. Factor III states env vars "are
  granular controls, each fully orthogonal to other env vars. They are never
  grouped together as 'environments'", objecting that grouping "does not scale
  cleanly: as more deploys of the app are created, new environment names are
  necessary".
- Also what the Node.js documentation points to, which shows
  `if (process.env.NODE_ENV === 'development')` branches as the failure mode and
  recommends Twelve-Factor config instead.
- Any value can be changed anywhere without pretending to be in a different
  environment — including turning on debug logging in a deployed environment to
  diagnose a live problem.
- Aligns with Factor X (dev/prod parity): environments differ by explicit values
  rather than by code paths, so behaviour is testable.
- No branching in service code, so no "worked in dev, broke in prod" class of bug.

**Against**

- Every knob must be set explicitly in every deploy. With one setting that is
  trivial; with fifteen it is a wall of `.env` entries where a newcomer cannot
  tell which matter and which are incidental.
- No sensible local defaults. A fresh clone gets production-shaped behaviour
  unless the developer knows which of the fifteen to flip.
- Twelve-Factor is optimising for many deploys of one app (its origin is Heroku's
  platform); local development ergonomics are not weighted heavily in it.
- Relying on ambient variables the SDK reads on its own — `OPENAI_LOG`,
  `OPENAI_AGENTS_DISABLE_TRACING` — spreads configuration across places that are
  invisible to the validated schema in `environment-variables.schema.ts`.

---

## The hybrid, and the rule that falls out

The three options are not mutually exclusive. The shape that survives all of the
above:

> An environment may choose a setting's **default**. It must never be the only
> way to change that setting.

Concretely: `AZURE_OPENAI_LOG_LEVEL`, if set, wins. If unset, the environment
supplies a default. This keeps the property Factor III actually cares about —
every value remains an independent control any deploy can set directly, with no
hidden grouping — while avoiding option 3's fifteen-variables-to-get-started
problem. What it rules out is behaviour reachable *only* by being in a given
environment, which is the specific thing the Node.js documentation flags.

Under this rule the `NODE_ENV`-vs-`APP_ENV` choice narrows considerably: the
discriminator picks defaults rather than gating behaviour, so getting it wrong is
cheap to correct.

Still undecided: which discriminator, and whether the environment-to-defaults
mapping should be an explicit table (`Record<Environment, Partial<Settings>>`,
the equivalent of ASP.NET's layered `appsettings.{Environment}.json`) or ad-hoc
per-setting logic. With one setting pivoting, a table is speculative structure;
the shape should be driven by the second and third real pivot, not guessed now.

## Revisit when

- A staging or other production-like environment is added — this is the trigger
  that makes option 1 actively wrong, and the point at which the `NODE_ENV`
  pinning in option 2 has to be got right.
- A third or fourth setting starts pivoting on environment, which is when the
  defaults-table question becomes answerable from evidence.
- Managed identity replaces the Azure OpenAI API key (see `AZURE_OPENAI_API_KEY`
  in [env.md](./env.md)), since credential shape may differ per environment and
  is the most likely second pivot.

## Implementation notes for whichever option wins

- New variables belong in `environment-variables.schema.ts` with `class-validator`
  decorators and in the table in [env.md](./env.md) — not read from `process.env`
  at the point of use. `ConfigurationService` is the only place that reads config.
- [code-conventions.md](./code-conventions.md) prefers enums over string unions,
  so the environment values and any log level want to be enums rather than
  `as const` string unions.
- The `openai` client's `logLevel` accepts `'off' | 'error' | 'warn' | 'info' | 'debug'`.
  Anything typed locally must stay assignable to that.

## Sources

- [Node.js — The difference between development and production](https://nodejs.org/learn/getting-started/nodejs-the-difference-between-development-and-production)
- [12factor.net — III. Config](https://12factor.net/config)
- [12factor.net — X. Dev/prod parity](https://12factor.net/dev-prod-parity)
- [NestJS — Configuration](https://docs.nestjs.com/techniques/configuration) — mentions `NODE_ENV` only inside a Joi validation example; recommends swapping `.env` files rather than branching on an environment value.
- [Michal Zalecki — Do not rely on NODE_ENV](https://michalzalecki.com/do-not-relay-on-node-env/)
- [Setting NODE_ENV is an antipattern — DEV](https://dev.to/hienngm/setting-nodeenv-is-an-antipattern-4dha)
- [Why is NODE_ENV=beta an error? — DEV](https://dev.to/aws-builders/why-is-nodeenvbeta-an-error-1mig)
