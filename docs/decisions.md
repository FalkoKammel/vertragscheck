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

## 017 · Three CDK stacks and two Lambdas instead of five stacks

- **Context:** The first plan had five stacks (Web, Api, Analysis, Data, Ops) and one Lambda per endpoint. For a one-person project this means many cross-stack references and exports, slower deploys, and more cold paths, without anything that needs to be deployed separately. Web, API and queue always change together.
- **Decision:** `DataStack` holds the stateful resources (DynamoDB, S3 buckets for uploads and texts) and is retained on destroy. `AppStack` holds everything that can be rebuilt: web hosting, API Gateway, Lambdas and the queue. `OpsStack` (budget, alarms) comes later. The API is **one router Lambda** that dispatches by route plus **one SQS-triggered analysis Lambda**. The web hosting is a `WebHosting` construct in `infra/lib/constructs`, not its own stack.
- **Web hosting details:** Private S3 bucket behind CloudFront with Origin Access Control. A CloudFront Function appends `.html` to extension-less paths (`/de/upload` → `/de/upload.html`, see 016) and redirects `/` to `/de`. `/_next/static/*` is cached for a year, everything else for a minute, and missing files get the exported `404.html` (superseded by 023: the function now answers unknown pages itself). `BucketDeployment` uploads `apps/web/out` and invalidates the distribution, which adds a helper Lambda that only runs during deploys. The web bucket is deleted with the stack because it only holds a build artifact.
- **Consequences:** Fewer stacks and no cross-stack plumbing between web, API and queue; one place to look for the app. One router Lambda means one cold start path and one bundle, but all routes share one IAM role, so it gets the union of the permissions, and a bug in one route can affect all. If a route needs different permissions or scaling, it can be split out of the router later. The data stack stays separate so a bad `AppStack` deploy or destroy can never delete contracts or analyses.

## 018 · Direct browser upload to S3 with a presigned POST

- **Context:** Contracts are PDFs up to 10 MB. API Gateway accepts at most 10 MB per request and a synchronously invoked Lambda about 6 MB, so the file cannot go through the API. The upload bucket must stay private and must not be usable for anything but contract uploads.
- **Decision:** `POST /api/uploads` checks captcha, daily limit and monthly budget, creates the analysis ID and returns a presigned POST for exactly `uploads/<analysisId>.pdf`, valid for 5 minutes. The browser uploads straight to S3. The presigned POST carries conditions that S3 enforces itself: `content-length-range` 1 byte to 10 MB and `Content-Type: application/pdf`. A presigned PUT was not used because it cannot express a maximum size, only an exact one. The analysis Lambda still checks that the file starts with `%PDF` and rejects documents above a page limit, because the content type is only a claim by the client.
- **Consequences:** The API never handles file bytes, uploads are fast and cheap, and the bucket stays private. Nobody can choose the object key, overwrite other uploads or upload without passing the checks. The bucket needs a CORS rule that allows POST from the site's domain.

## 019 · Idempotent analysis

- **Context:** S3 event notifications are delivered at least once, SQS can redeliver a message, and a client can use a valid upload URL twice within its lifetime. Each of these could trigger a second Bedrock call for the same contract.
- **Decision:** The analysis Lambda moves the analysis from `pending_upload` to `running` with a conditional update (`status = pending_upload`). If the condition fails, the message is acknowledged and nothing else happens. Only the invocation that won the update calls Bedrock.
- **Consequences:** Every contract is analysed and billed at most once, retries are safe, and duplicate events cost a single DynamoDB write. A job that crashes while `running` is not picked up again automatically; it ends up in the dead-letter queue and is marked as failed.

## 020 · Wildcard CloudFront origin in the uploads bucket CORS rule

- **Context:** The browser POSTs the PDF straight to S3, so the uploads bucket needs a CORS rule for the site's origin. The bucket lives in `DataStack`, the CloudFront domain in `AppStack`, and `AppStack` already depends on `DataStack` for the table and bucket. Passing the domain back would be a circular dependency.
- **Decision:** The CORS rule allows `POST` from `https://*.cloudfront.net` and `http://localhost:3000` (development). S3 accepts one `*` per origin. Origins are a prop of `DataStack` (`uploadOrigins`), so they can be replaced by the exact custom domain later.
- **Consequences:** Any CloudFront site could ask a browser to POST to the bucket, but the bucket is private and a POST only succeeds with a valid presigned policy (key, size and content type are fixed, see 018), so CORS is not the access control. Moving the distribution out of `AppStack`, or adding a custom domain, would allow an exact origin.

## 021 · Bundler module resolution in `services/api`

- **Context:** The base config uses `NodeNext`, which forces `.js` endings on relative imports. The Lambdas are bundled by esbuild (CDK `NodejsFunction`) and tested with Vitest, so Node's own ESM resolution is never used at runtime.
- **Decision:** `services/api/tsconfig.json` overrides `module: "Preserve"` and `moduleResolution: "bundler"`. Relative imports have no file endings. The base config and the other packages are unchanged (see 015).
- **Consequences:** Cleaner imports. Code in `services/api` must always be bundled and cannot be run directly with `node`.

## 022 · Upload API wiring: origin request policy and runtime site hostname

- **Context:** CloudFront forwards `/api/*` to an HTTP API. The handler needs the client IP (`CloudFront-Viewer-Address`) and Turnstile checks the hostname of the site. Two problems: the managed `AllViewerExceptHostHeader` policy does not forward `CloudFront-*` headers, and the variant that does (`allViewerAndWhitelistCloudFront`) also forwards `Host`, which API Gateway rejects. The site hostname is the CloudFront domain, so passing it to the Lambda as an environment variable would be circular (Lambda → API → distribution → Lambda).
- **Decision:** A custom origin request policy forwards only `CloudFront-Viewer-Address`, `Content-Type` and `Accept`, all query strings and no cookies. Caching is disabled on `/api/*`. The router Lambda reads the hostname at runtime from the plain SSM String parameter `/vertragscheck/site-hostname` (cached like the secrets), created by hand after the first deploy, together with the SecureStrings `/vertragscheck/ip-hash-secret` and `/vertragscheck/turnstile-secret`. IAM allows `ssm:GetParameter` on exactly these three ARNs, `s3:PutObject` on `uploads/*` only, and `kms:Decrypt` only via SSM for the two secrets' encryption context. The Lambda is bundled as ESM (top-level await) with the AWS SDK included, because `@aws-sdk/s3-presigned-post` is not in the Lambda runtime. The monthly budget (default 10 USD) is the prop `budgetLimitMicroUsd`.
- **Consequences:** The first deploy works, but upload requests fail with a 500 until the three parameters exist. A new header the API needs must be added to the allowlist. `esbuild` is a devDependency of `infra`.

## 023 · 404 for the static site in the CloudFront Function, no distribution-wide error responses

- **Context:** The distribution had custom error responses that turned every 403 and 404 into `/404.html`, because a private S3 bucket answers 403 for missing keys. They apply to the whole distribution, so they also replaced the API's own `403 CAPTCHA_INVALID` and would replace every future `404 NOT_FOUND` from `/api/*`. A viewer-response function cannot fix this, because CloudFront does not run functions when the origin answers with an error (status 400 and above).
- **Decision:** The custom error responses are removed. The existing viewer-request function on the default behavior now knows the pages of the static export (the `.html` files of `apps/web/out`, collected when the stack is synthesized) and answers `404` with a small inline HTML page for any clean URL that is not one of them. It uses the design colours but not the Next.js `404.html`, because the function code is limited to 10 KB. Paths with a file extension are passed through unchanged.
- **Consequences:** `/api/*` responses reach the browser unchanged. The list of valid pages needs no manual upkeep, but a new page only becomes reachable after the next deploy, which is when the export is deployed anyway. A missing file with an extension (for example an old `/_next/static/*` chunk) returns S3's raw 403 XML. The exported `404.html` is no longer served.

## 024 · Client-side upload flow, Turnstile wrapper and MSW in development

- **Context:** The upload page runs entirely in the browser: request a presigned POST, store the delete token, upload to S3 with a progress bar, redirect. Turnstile tokens are single-use, and the API does not exist while developing the frontend. Upload and analysis are one process for the user, shown in one progress card.
- **Decision:** The flow lives in a `useUpload` hook with explicit states (`idle`, `requesting`, `uploading`, `done`, `error`) and injectable dependencies; the API client, the XHR upload, the file check and the error-code-to-message mapping are separate pure modules. The analysis (ID, delete token, file name) is written to `localStorage` right after `POST /api/uploads` and before the S3 upload, so the delete token is not lost if the tab closes; a storage failure never blocks the upload. Every error resets the Turnstile widget through an `onError` callback. Turnstile uses `@marsidev/react-turnstile`. The hook's states are rendered in a shared `AnalysisProgress` card (upload step, then analysis step) that replaces the form on the same page once the API has accepted the request (the form shows a spinner while waiting, so a refused request does not flash the card); only errors stay in the form, which comes back on failure. Until the status endpoint exists the card stays on screen after the upload and nothing redirects; later it polls and goes to `/result?id=` when the analysis is done (see "Upload and progress card" in `PLAN.md`). In development, MSW answers `/api/uploads` and a fake S3 URL from one file (`mocks/browser.ts`); `?mock=captcha|limit|budget|internal` on the page URL returns that API error. Network and S3 errors are covered by unit tests, not by mocks. A small `MockProvider` starts the worker only when `NODE_ENV` is `development`. Responses from the API are validated with Zod.
- **Consequences:** `public/mockServiceWorker.js` is generated by `msw init` and ends up in the static export, but nothing registers it in production. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is read at build time, so the deploy workflow passes the repo variable to every step that builds `apps/web`. Without the variable the page shows a configuration error instead of the widget. The analysis step is a single indeterminate step until the backend reports finer progress.

## 025 · Analysis queue settings, notification placement and Bedrock scope

- **Context:** The analysis Lambda runs for up to 2 minutes per contract and calls a paid model. Events are delivered at least once (see 019) and a failing job must neither retry forever nor burn budget.
- **Decision:** S3 `ObjectCreated` events for `uploads/*.pdf` go to an SQS queue with a dead-letter queue (`maxReceiveCount` 3, DLQ retention 14 days). Visibility timeout is 6x the Lambda timeout (12 min for 2 min), as AWS recommends, so a message is not redelivered while its invocation is still running or being retried. Batch size 1, memory 1024 MB, `maxConcurrency` 2 on the SQS event source (reserved concurrency failed at the first deploy: AWS keeps 10 executions unreserved and the account quota is 10). The notification is attached to a re-imported handle of the uploads bucket inside `AppStack`; attaching it to the `DataStack` bucket would make `DataStack` depend on the queue while `AppStack` already depends on `DataStack`. IAM: `GetObject`/`DeleteObject` on `uploads/*`, `PutObject` on `texts/*`, `bedrock:InvokeModel` only on the configured inference profile in our region plus the foundation model in each EU region the profile routes to (`DEFAULT_MODEL_ROUTING_REGIONS`). `texts/` expires after 30 days.
- **Consequences:** Retries are bounded to three attempts per upload. The notification custom resource manages the whole notification configuration of the bucket, so no other notification may be added to it elsewhere. Changing `MODEL_ID` to another profile requires checking the routing regions list. It has not been verified against `get-inference-profile` yet (no AWS access when written).
- **Concurrency follow-up:** `maxConcurrency` limits parallel invocations only for this queue; unlike reserved concurrency it does not guarantee capacity and does not stop other triggers. That is fine because the queue is the only trigger. Switch to reserved concurrency once the quota is raised.

## 026 · No prompt caching for Bedrock calls

- **Context:** Each analysis sends a fixed system prompt plus the contract text to Bedrock. Prompt caching could make the repeated prefix cheaper (cache reads cost 0.1x the input price, cache writes 1.25x).
- **Decision:** Prompt caching is not used. (1) The fixed prompt is probably too small to be cached at all: models only cache prefixes above a minimum length (a few thousand tokens for Haiku 4.5), and the contract text differs per request, so only the short system prompt could ever be cached. (2) Request frequency is expected to be low for a portfolio project. The cache lives for about 5 minutes, so consecutive analyses would rarely fall into the same window, and most calls would only pay the higher write price without a read.
- **Consequences:** `pricing.ts` still accepts `cacheReadTokens` and `cacheWriteTokens` (both optional) so the cost stays correct if caching is enabled later, but the use case does not set cache points. Revisit if the prompt grows well past the minimum or traffic becomes steady.

## 027 · Analysis Lambda wiring and result write

- **Context:** The analysis use case reads the analysis, flips it to `running`, and writes the final result back to the item that `RequestUpload` created. Creating the item and updating it are different operations and keep different guards.
- **Decision:** `save` stays create-only (`attribute_not_exists(PK)`). `markRunning` is a conditional `UpdateItem` (`pending_upload` → `running`) and tells duplicate SQS deliveries apart. `saveResult` is a conditional `UpdateItem` that only sets the result fields (status, clauses, unverifiedQuotes, invalidClauses, run, failure reason) and only while the status is `running`. Like `RouterApiHandler`, `AnalysisHandler.ts` is one file: composition root plus the exported `analysisHandler`, which is also the CDK entry point. The budget adapter is `DynamoBudgetStore` (it checks and adds). The Bedrock adapter forces a `report_clauses` tool whose JSON schema comes from the Zod clause schemas and caps output at 8192 tokens.
- **Consequences:** If the process dies between `markRunning` and `saveResult`, the analysis stays `running` (the SQS retry sees a duplicate and does nothing). A reaper or a timeout-based status check is needed later if that happens in practice. The handler test sets the environment and mocks the use case, because importing the module builds the adapters.

## 028 · Status endpoint with effective status and no cache

- **Context:** The frontend polls an analysis and renders the result page from one call. A job that dies between `markRunning` and `saveResult` stays `running` for ever (see 027), and an upload that never arrives stays `pending_upload` until the TTL.
- **Decision:** `GET /api/analyses/{id}` in the router Lambda. `markRunning` also stores `startedAt`. `Analysis.effectiveStatus(now)` is a pure, read-only calculation: `running` for more than `RUNNING_TIMEOUT_MS` (5 min, well above the 2 min Lambda timeout) is reported as `failed` / `TIMEOUT`, `pending_upload` for more than `UPLOAD_TIMEOUT_MS` (15 min, the presigned POST is valid for 5 min) as `failed` / `UPLOAD_MISSING`. Nothing is written back, so a late `saveResult` still wins. A `running` item without `startedAt` (written before the field existed) never times out. The ID must be a UUID; an invalid, unknown or expired ID gives the same `404 ANALYSIS_NOT_FOUND`, so the API does not reveal whether an ID ever existed. The response is built field by field in `AnalysisResponseMapper` (never the entity: no `deleteTokenHash`, no `startedAt`) and contains the contract text and clauses only when the effective status is `done`; a `done` analysis whose text is missing in S3 is reported as `failed` / `INTERNAL`. Every API response has `Cache-Control: no-store`. The response type lives in the backend mapper, the frontend validates it with its own Zod schema (same as the upload response, there is no shared package). Logs contain only ID and status.
- **Consequences:** Stuck jobs show up as failed without a reaper; the stored item stays `running` until its TTL, which is invisible to clients. The result page needs one request per poll, including the full text once done. The router role reads the text with `s3:GetObject` on `texts/*` only.

## 029 · Processing stage on a running analysis

- **Context:** The progress card shows what a running analysis is doing, but the item only knew `running`. The model call is the long part (seconds), extraction is short.
- **Decision:** An optional `stage` (`extracting` | `analysing`) on the analysis item, only meaningful while `running`. `markRunning` sets `extracting` in the same update as the status. The use case sets `analysing` right before the Bedrock call through the port `markStage(id, stage)`, a conditional update on `status = running` that does nothing if the analysis is no longer running. `saveResult` removes the attribute. The status response contains `stage` only while the effective status is `running`.
- **Consequences:** One extra DynamoDB write per analysis. The stage is a progress hint, not state: a failed `markStage` condition is ignored. Finer steps later extend the enum. Items without `stage` (written before) are valid; the frontend then shows the first step.

## 030 · Offline evaluation tool

- **Context:** To compare models and prompt versions we need numbers from labelled contracts (`eval/contracts/`), produced by the same code path as production.
- **Decision:** `eval/` is a workspace package that depends on `api` (`workspace:*`) and imports the production `ContractText`, `BedrockAnalyser` and `calculateCostMicroUsd` through deep paths. It runs locally with tsx and calls Bedrock sequentially only from `pnpm --filter eval eval`; tests and CI never call Bedrock. Labels are anchored by unique text snippets, which are resolved to `[start, end)` spans in the same normalised text the model sees. A returned clause hits a label when the spans overlap. A label hit only by a `fine` clause counts as missed and is reported separately ("seen but rated fine") from labels not hit at all. Raw results (`eval/results/*.json`) are committed so they can be re-graded with `eval:grade`; `eval/summary.json` holds the latest numbers per model for the transparency page, and every run appends a section to `docs/eval.md`.
- **Consequences:** The eval stops if the model has no price in `pricing.ts` instead of guessing. The label set is small (8 contracts), so every percentage is shown with its counts. Contract text of the test set is committed; it is synthetic, not user data. Calls are retried up to 3 times with a 30 s pause; if the first call still fails or every call fails, nothing is written. If more than 10 % of the calls fail, the raw results file is kept but `docs/eval.md`, `eval/summary.json` and the unmatched file are not written, so an incomplete run cannot end up on the transparency page.
