# Architecture decisions

Short log of the decisions behind Vertragscheck. One entry per decision: what I chose, why, and what I gave up. New decisions go at the bottom; if one is reversed, mark it as superseded instead of deleting it.

Format per entry: **Context** (the problem), **Decision**, **Consequences** (trade-offs).

---

## 001 · Serverless (Lambda) instead of containers (ECS/Fargate)

- **Context:** Traffic is low and bursty (recruiters clicking a demo link). Budget is a few euros a month.
- **Decision:** API Gateway + Lambda for the API, a separate Lambda for the analysis.
- **Consequences:** Nearly zero cost when idle and no servers to patch. Cold starts of a second or two are acceptable because the analysis is asynchronous anyway. Lambda's 15-minute limit is far above a single analysis.

## 002 · Asynchronous analysis via S3 event → SQS

- **Context:** An LLM call takes 5–30 seconds; API Gateway times out after 29 seconds.
- **Decision:** The browser uploads straight to S3 with a presigned URL. The S3 event goes to SQS, the analysis Lambda consumes it. The frontend polls the status.
- **Consequences:** A slow model never blocks the UI, retries come for free, failed jobs land in a dead-letter queue. Cost: polling and an extra "processing" state in the UI.

## 003 · DynamoDB single table

- **Context:** Few access patterns: get analysis by ID, list its clauses, read and update the monthly budget, count analyses per IP and day.
- **Decision:** One table with `PK`/`SK`: `ANALYSIS#<id>` / `META` with the clauses embedded as a list, `BUDGET#<yyyy-mm>` / `TOTAL`, and a rate-limit item per IP hash and day. A GSI on `MONTH#<yyyy-mm>` serves the transparency page. TTL of 30 days. The extracted contract text goes to S3, not DynamoDB.
- **Why clauses are embedded:** they are always read and written together with their analysis and stay far below the 400 KB item limit, so one `GetItem` loads a whole result. A separate item per clause would only pay off if clauses were queried on their own.
- **Consequences:** Pay per request, no schema migrations, automatic deletion via TTL. Ad-hoc queries are harder than in SQL; the stats page uses counters plus a monthly GSI query.

## 004 · No login in the MVP

- **Context:** Recruiters won't create an account to try a demo. Login also adds Cognito, email flows and more personal data.
- **Decision:** No accounts. Precomputed sample analyses are visible immediately. Own uploads need a captcha (Cloudflare Turnstile) and are limited to 3 per IP per day. IPs are stored only as a hash.
- **Consequences:** Lowest friction for visitors, less personal data. Abuse protection relies on the captcha, the daily limit and the monthly budget block (005). An admin login can come later.

## 005 · Monthly budget with automatic block

- **Context:** A public LLM endpoint can get expensive if abused.
- **Decision:** The analysis Lambda prices the token usage from the Converse response with a pricing table in code and adds it to a monthly budget item; at 100 % new analyses are refused until the month ends. Reserved concurrency and queue limits cap the blast radius. An AWS budget with an action that attaches a `Deny bedrock:InvokeModel*` policy to the analysis role is the account-level backstop.
- **Why not invocation logs:** in a shared account with many callers, Bedrock model invocation logs plus a pricing Lambda are the reliable way to see all spend. Here this app is the only caller and already has the usage in hand, so counting in the app is simpler and blocks immediately.
- **Consequences:** Cost can never run away. In the worst case the demo shows "budget reached" and only sample analyses work. The pricing table has to be updated by hand when prices change.

## 006 · Next.js as a static export on S3 + CloudFront, not on ECS

- **Context:** The start, upload and transparency pages are fixed; results and figures belong to one user or come live from the API and should not be indexed. Server-side rendering would not change what the user sees.
- **Options considered:** Next.js with SSR on ECS Fargate costs roughly 35–40 USD a month before the first visitor (smallest Fargate task running 24/7, an Application Load Balancer at about 20 USD, public IPv4 addresses), twice the project budget. Amplify Hosting or OpenNext on Lambda would bill per request, but add a second backend path next to API Gateway.
- **Decision:** `output: 'export'`, hosted on S3 behind CloudFront. Pages are rendered at build time; all data is fetched in the browser from API Gateway + Lambda. CloudFront routes `/api/*` to API Gateway, so site and API share one domain and no CORS is needed.
- **Consequences:** Hosting costs close to nothing, frontend and backend are cleanly separated. No server actions, route handlers, middleware or per-request SSR. Dynamic routes like `/result/[id]` cannot be pre-rendered, so the result page uses `/result?id=<id>`. Behind CloudFront the client IP for the daily limit comes from the `CloudFront-Viewer-Address` header.

## 007 · Bedrock with an EU inference profile and a configurable model

- **Context:** Contracts contain personal data; I want the processing in the EU and in the same AWS account. Model quotas differ (Haiku 5.5 is at 0 on my account so far).
- **Decision:** Bedrock Converse API via the EU cross-region inference profile. The model ID comes from config (`MODEL_ID`), starting with `eu.anthropic.claude-haiku-4-5-20251001-v1:0`. Lambda uses an IAM role, no API keys.
- **Consequences:** Switching models is a config change, which is what makes the model comparison on the eval set possible. Locked to models available on Bedrock.

## 008 · Structured output, Zod validation and quote verification

- **Context:** LLMs can return invalid JSON or invent clauses that aren't in the contract.
- **Decision:** The model answers in a fixed JSON schema. The answer is validated with Zod; invalid answers are retried once, then stored as an error. Every clause must contain a verbatim quote, and code checks that the quote exists in the extracted text (after whitespace normalisation). Quotes that aren't found are dropped and counted.
- **Consequences:** Users only see text that is really in their contract. The rate of dropped quotes becomes a quality metric on the transparency page.

## 009 · Highlighting in the extracted text, not in the PDF

- **Context:** Highlighting inside the original PDF (pdf.js text layer, coordinates) is a lot of work.
- **Decision:** The result page shows the extracted text with highlights at the verified quote positions. PDF highlighting is a later extension.
- **Consequences:** Much simpler, fits the deadline. The layout of the original PDF is lost.

## 010 · German and English with next-intl

- **Context:** I want to apply in Germany and abroad.
- **Decision:** UI and explanations in German and English (`/de`, `/en`, German default) with `next-intl`. The legal assessment is always based on German law.
- **Consequences:** Every string goes through message files; the LLM gets the target language as a parameter.

## 011 · Lightweight clean architecture in the backend

- **Context:** The core logic (validation, quote verification, cost) must be testable without AWS, and the model must be swappable.
- **Decision:** `services/api` is split into `domain` (pure logic), `application` (use cases plus port interfaces), `adapters` (Bedrock, S3, DynamoDB, PDF) and `handlers` (thin Lambda entry points that wire everything together). Inner layers never import outer ones. The frontend stays a normal Next.js app.
- **Consequences:** The analysis use case is tested with a fake LLM and an in-memory repository. Swapping Bedrock for another provider means one new adapter. It costs a few extra files and interfaces, so no further layers, no DI framework, no generic repositories.

## 012 · Deletion after 30 days, no contract content in logs

- **Context:** GDPR; contracts contain names, addresses, salaries.
- **Decision:** The PDF is deleted right after text extraction. Extracted text (S3 lifecycle) and analysis (DynamoDB TTL) are deleted after 30 days; reads treat expired items as gone because TTL deletion is asynchronous. Logs contain only IDs, durations and token counts.
- **Consequences:** Analyses cannot be looked at later for debugging; the eval set uses my own sample contracts instead.

## 013 · Access by secret link, early deletion by token

- **Context:** Without accounts there is no owner to check, but results must not be public and users should be able to delete them.
- **Decision:** Each analysis has a random UUID that is part of its link; whoever has the link can see it, analyses are never listed. The browser keeps the user's analyses in `localStorage`. On creation the API returns a delete token once and stores only its hash; `DELETE /analyses/<id>` needs that token.
- **Consequences:** No login and no personal data for identity. A shared link exposes the analysis to whoever receives it, and losing the browser storage means waiting for the 30-day deletion.

## 014 · Daily limit by HMAC of the IP in DynamoDB

- **Context:** 3 analyses per client and day without accounts. API Gateway usage plans work per API key, not per IP, and AWS WAF rate rules count over minutes and add a fixed monthly cost.
- **Decision:** A DynamoDB item per HMAC(IP, secret) and day, increased with a conditional update when an upload URL is issued, expiring after two days. Captcha is checked first.
- **Consequences:** Cheap and race-free, no raw IPs stored. Easy to get around by switching networks, which is acceptable because the monthly budget is the hard ceiling.

## 015 · Tooling: pnpm workspace, TypeScript 6.0, ESLint flat config, Vitest

- **Context:** Three packages (`apps/web`, `services/api`, `infra`) need one shared toolchain and one `pnpm verify` entry point.
- **Decision:** Dev tooling lives once in the root `package.json` with exact versions (`save-exact`). Shared `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. One ESLint flat config with `typescript-eslint` `strictTypeChecked` (no `any`), Prettier for formatting (not applied to `docs/` and `.claude/`), one Vitest root config with a project per package. TypeScript is pinned to 6.0.3 and `@types/node` to 24.x (Lambda runtime).
- **Consequences:** TypeScript 7 is the latest release, but `typescript-eslint` 8.72 only supports `<6.1.0`, so we stay on 6.0 until it catches up. Packages get their own dependencies later (Next.js, CDK, Zod, AWS SDK) and may override `module` settings, e.g. Next.js with `Bundler` resolution.

## 016 · Static i18n routing with root params, design tokens in the Mantine theme

- **Context:** A static export cannot run middleware, so `next-intl` cannot detect or redirect locales at request time. Its older `setRequestLocale` pattern is deprecated in favour of `next/root-params`, and the lint setup rejects deprecated APIs.
- **Decision:** `localePrefix: 'always'` with `generateStaticParams`, so every page is pre-rendered as `/de/…` and `/en/…`. `app/[locale]/layout.tsx` is the root layout and `i18n/request.ts` reads the locale with `next/root-params`; there is no `setRequestLocale` and no `params` plumbing in the pages. A second root layout in the route group `app/(root)` renders `/` as a plain `<meta http-equiv="refresh">` page to `/de` with links to both languages. Design colours, fonts and radii live only in `apps/web/src/theme.ts`, which also exposes them as `--vc-*` CSS variables for CSS modules.
- **Consequences:** No middleware and no client-side locale redirect. The HTML files are `de.html` etc. rather than `de/index.html`, so the CloudFront/S3 setup in `WebStack` has to map `/de` to `/de.html` (or switch on `trailingSlash`) and should redirect `/` to `/de` itself. Next generates no types for the `[locale]` root param yet ("No root params detected"), so `src/root-params.d.ts` declares `locale()` by hand; remove it once Next detects the param. Components that pass a function or component to a Mantine client component need a `'use client'` wrapper (`Providers`, `LinkButton`).
