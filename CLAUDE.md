# Vertragscheck

Portfolio project by Falko Kammel. A web app that analyses German rental and employment contracts with an LLM, highlights notable clauses in the contract text and shows cost and quality metrics openly. Target: MVP live by 30 November 2026.

Full plan: `docs/PLAN.md`. UI designs (source of truth for layout, colours, copy): `docs/design/*.html`. Architecture decisions: `docs/decisions.md`.

## Stack

- pnpm workspaces, Node 24, TypeScript `strict` everywhere, no `any`
- `apps/web`: Next.js (App Router, `output: 'export'`, static site on S3 + CloudFront), Mantine for UI components, `next-intl` for German and English (`/de`, `/en`, German is the default). No server actions, route handlers, middleware or request-time SSR: all data comes from the API under `/api/*`. Result page is `/result?id=<id>`, not a dynamic route.
- `services/api`: AWS Lambda handlers in TypeScript, AWS SDK v3, Zod for every boundary (API input, LLM output, DynamoDB items)
- `infra`: AWS CDK v2 in TypeScript, region `eu-central-1`
- LLM: Amazon Bedrock, Converse API. Model ID comes from config (`MODEL_ID`), never hardcoded. Default: `eu.anthropic.claude-haiku-4-5-20251001-v1:0`
- Tests: Vitest

## Structure

```
apps/web              Next.js frontend (pages: start, upload, result, transparency)
services/api
  src/domain          pure logic: Zod schemas, quote verification, cost calculation
  src/application     use cases (analyze-contract, create-upload, get-analysis, get-stats)
                      + ports.ts: interfaces LlmClient, DocumentStore, TextExtractor,
                        AnalysisRepository, BudgetRepository
  src/adapters        implementations of the ports: Bedrock, S3, DynamoDB, PDF text extraction
  src/handlers        thin Lambda entry points: parse event, build adapters, call use case
infra                 CDK app and stacks (Web, Api, Analysis, Data, Ops)
docs                  PLAN.md, decisions.md, design/
evals                 test contracts + expected clauses
```

Backend architecture is a lightweight clean architecture (see `docs/decisions.md`, 011):

- Dependency rule: `handlers → adapters → application → domain`. Inner layers never import outer ones. `domain` and `application` import no AWS SDK.
- Use cases receive their ports as plain function/constructor arguments. No DI framework, no generic base classes, no extra layers.
- Tests: `domain` with plain unit tests, `application` with in-memory fakes of the ports (e.g. a fake LLM returning fixed JSON), adapters only where it pays off.
- The frontend is a normal Next.js app; no clean-architecture layers there.

## Architecture in one paragraph

CloudFront serves the static site and routes `/api/*` to API Gateway. The browser uploads the PDF straight to S3 via a presigned URL. An S3 event goes to SQS, an analysis Lambda extracts the text (stored in S3, PDF deleted afterwards), calls Bedrock with a fixed JSON schema, validates the answer with Zod, verifies every quote against the original text (drops quotes that are not found), and stores one DynamoDB item per analysis with the clauses, tokens and cost embedded (single table, 30-day TTL). The frontend polls the status. No login: results are reachable by their random ID, the browser keeps its own list in `localStorage`, early deletion needs a delete token. Captcha plus a limit of 3 analyses per IP and day (HMAC of the IP in DynamoDB), and a monthly budget that blocks new analyses at 100 %. Sample analyses are precomputed. Data model and details: `docs/PLAN.md`.

## Design

- Follow `docs/design/*.html` closely: layout, spacing, copy, states.
- Use Mantine components and its theme. Put all design colours, fonts and radii into one Mantine theme (`apps/web/src/theme.ts`), never as hex values in components. Custom styles go in CSS modules, not inline styles.
- No Tailwind.
- Colours: ink `#14181F`, body text `#3D4552`, muted `#5B6472`, page background `#F5F6F8`, cards `#FFFFFF` with border `#E2E5EA`, accent `#1F4E8C`.
- Traffic light: critical bg `#FBD9C5` / line `#C2410C` / text `#9A3412`; check bg `#FDEFC3` / line `#B45309` / text `#7A4A05`; neutral bg `#E3E8EF` / text `#3D4552`.
- Fonts: Inter for UI, Source Serif 4 for contract text.
- Accessible markup: real buttons, labels, focus states, sufficient contrast.

## Conventions

- Small, focused modules. Domain logic is pure and unit tested; handlers stay thin.
- Validate all external data with Zod. Treat LLM output as untrusted input.
- Never log contract content or personal data. Log IDs, durations, token counts.
- All user-facing strings go through `next-intl` messages, no hardcoded copy in components.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`), one logical change per commit.

## How to work with me

- For anything bigger than a small fix: propose a short plan first and wait for my OK.
- After a change, explain in a few sentences what you changed and why, so I can review it.
- Do not edit `services/api/src/domain/schemas.ts`, `quote-verification.ts` or `cost.ts` unless I ask. I write those myself. You may write tests for them.
- Ask before adding a new dependency.
- Never run `cdk deploy`, `cdk destroy` or anything that changes AWS resources without asking.
- Never commit secrets or `.env` files.
- Git: work on a feature branch (`feat/<topic>`, `fix/<topic>`), never commit or push to `main`. I review and merge into `main` myself. A hook in `.claude/settings.json` blocks pushes to `main` and force pushes.
- Before saying a task is done and before every commit, run the `verify` skill and show its result table.
- When unsure about a requirement, check `docs/PLAN.md` and the design files before asking.
- When we make a new architecture decision, add a short entry to `docs/decisions.md` (context, decision, consequences).

## Commands

```bash
pnpm install
pnpm verify                      # typecheck, lint, tests, build (all packages)
pnpm --filter web dev            # frontend on http://localhost:3000
pnpm --filter api test           # domain tests
pnpm --filter infra cdk synth
pnpm --filter infra cdk diff
```
