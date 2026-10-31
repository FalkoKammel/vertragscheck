# Vertragscheck – project plan

Vertragscheck analyses German rental and employment contracts with an LLM. It highlights notable clauses directly in the contract text, explains each one with a verbatim quote, and shows openly what every analysis costs and how often the model gets it wrong. MVP target: live by 30 November 2026.

Architecture decisions and their trade-offs: [`decisions.md`](decisions.md). UI designs: [`design/`](design/).

## Scope

**In the MVP**

- Four pages: start, upload, result, transparency (German and English, `/de` and `/en`)
- No accounts. Sample analyses are precomputed and visible immediately. Own uploads need a captcha and are limited to 3 per day
- Upload of one text-based PDF up to 10 MB, contract type: rental or employment
- LLM analysis: each clause gets a category, a traffic-light level (fine / check / critical), a verbatim quote and a short explanation. Every quote is verified against the extracted text; quotes that are not found are dropped
- Result view: contract text with coloured highlights, clause list next to it, clicking a clause scrolls to its highlight
- Per-analysis transparency (model, prompt version, tokens, cost, duration, dropped quotes) and a public transparency page with monthly figures, budget and model comparison
- Monthly budget with automatic block; all data deleted after 30 days, or earlier on request
- Eval set of 20–30 sample contracts with hand-labelled clauses, used to compare models and prompt versions

**Not in the MVP**

- Accounts and login
- Highlighting inside the original PDF (pdf.js)
- MCP server exposing the analysis
- Scanned PDFs (OCR), other contract types, comparing two versions, export, chat with the contract

## Architecture

Everything is serverless and defined with AWS CDK in TypeScript (region `eu-central-1`). Idle cost is close to zero; the main cost is LLM calls.

```
Browser ──▶ CloudFront ──┬─▶ /*      S3 (static Next.js export)
   │                     └─▶ /api/*  API Gateway ──▶ router Lambda (create upload, status/result,
   │                                                 delete, samples, stats)
   │                                                 captcha check, daily limit, budget check
   └─▶ S3 uploads bucket ◀── presigned POST
          │ S3 event
          ▼
         SQS (+ dead-letter queue)
          ▼
       Analysis Lambda ──▶ Bedrock (Converse API, JSON schema)
          │  text extraction, Zod validation, quote verification, cost
          ├─▶ S3: extracted text
          └─▶ DynamoDB: analysis + clauses + budget counters
```

The browser uploads straight to S3, the analysis runs asynchronously from a queue, and the result page polls the status. A slow model call never blocks the UI, and failed jobs end up in the dead-letter queue.

The frontend is a static Next.js export: pages are rendered once at build time, and all data is fetched in the browser from the API. There is no server-side rendering at request time, so no server actions, route handlers or middleware. CloudFront serves the site and the API under one domain (`/api/*`), which avoids CORS.

**CDK stacks**

- `DataStack` (stateful, rarely changes): DynamoDB table (TTL), S3 bucket for uploads and extracted text (lifecycle rules). Retained on `cdk destroy`.
- `AppStack` (everything that can be rebuilt): the `WebHosting` construct (private S3 bucket, CloudFront with OAC, URL-rewrite function, `BucketDeployment` of `apps/web/out`), API Gateway with `/api/*` routed from CloudFront, the **router Lambda** (one Lambda behind API Gateway that dispatches create upload, status/result, delete, samples and stats), SQS + DLQ and the **analysis Lambda** (SQS-triggered, Bedrock permissions, reserved concurrency), stage throttling.
- `OpsStack` (later): AWS budget with alert and IAM deny action, CloudWatch alarms (errors, DLQ)
- CI/CD: GitHub Actions with an OIDC role, `cdk deploy` on push to `main`

## Data model

### S3

| Key | Content | Lifetime |
| --- | --- | --- |
| `uploads/<analysisId>.pdf` | the uploaded PDF | deleted by the analysis Lambda right after text extraction; lifecycle rule after 1 day as a fallback |
| `texts/<analysisId>.json` | extracted text (pages, character offsets) | lifecycle rule: 30 days |
| `samples/<sampleId>.json` | extracted text of the sample contracts | permanent |

The PDF is only needed for extraction, so it is not kept. The extracted text lives in S3 rather than DynamoDB because a long contract can approach DynamoDB's 400 KB item limit.

### DynamoDB (one table, `PK` / `SK`)

**Analysis** – one item per contract, clauses embedded:

```jsonc
{
  "PK": "ANALYSIS#3f9c…",            // random UUID, also the secret in the result link
  "SK": "META",
  "status": "done",                   // uploaded | running | done | failed
  "contractType": "rental",           // rental | employment
  "language": "de",                   // language of the explanations
  "createdAt": "2026-11-03T10:15:00Z",
  "pageCount": 12,
  "textKey": "texts/3f9c….json",
  "deleteTokenHash": "sha256:…",      // see "Retention and deletion"
  "model": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
  "promptVersion": "v3",
  "usage": { "inputTokens": 7412, "outputTokens": 1388 },
  "costMicroUsd": 14300,              // integer, no float rounding
  "durationMs": 6200,
  "quotes": { "total": 19, "dropped": 1 },
  "clauses": [
    {
      "ref": "§ 4",
      "category": "deposit",
      "level": "critical",            // fine | check | critical
      "quote": "vier Nettokaltmieten",
      "start": 1834, "end": 1854,     // character offsets in the extracted text
      "reason": "Die Kaution darf höchstens drei Nettokaltmieten betragen (§ 551 BGB) …"
    }
  ],
  "GSI1PK": "MONTH#2026-11",          // for the transparency page
  "GSI1SK": "2026-11-03T10:15:00Z",
  "ttl": 1796292900                   // createdAt + 30 days, epoch seconds
}
```

Clauses are embedded because they are always read and written together with their analysis, and 20–30 clauses stay well below 50 KB. One `GetItem` loads the whole result. Cost and usage belong to the analysis, so they sit in the same item.

**Monthly budget and counters:**

```jsonc
{ "PK": "BUDGET#2026-11", "SK": "TOTAL",
  "costMicroUsd": 2400000, "limitMicroUsd": 10000000,
  "analyses": 184, "quotesTotal": 3510, "quotesDropped": 74 }
```

Updated with an atomic `ADD` after every analysis.

**Daily limit per client:**

```jsonc
{ "PK": "RATE#<hmac(ip)>#2026-11-03", "SK": "COUNT", "count": 2, "ttl": <now + 2 days> }
```

**Samples:** same shape as an analysis with `PK = ANALYSIS#sample-rental` and no `ttl`.

**Access patterns**

| Use | Operation |
| --- | --- |
| Result page, status polling | `GetItem ANALYSIS#<id> / META` |
| Check and increase daily limit | conditional `UpdateItem RATE#… / COUNT` |
| Check budget before an analysis, add cost after | `GetItem` / `UpdateItem BUDGET#<month> / TOTAL` |
| Transparency page (p95 duration, per-model figures) | `Query GSI1 MONTH#<month>`, result cached for a few minutes |
| Delete early | `DeleteItem ANALYSIS#<id> / META` + delete `texts/<id>.json` |

## Retention and deletion

- **Who can see an analysis:** anyone who has its link, nobody else. The link contains a random UUID (122 random bits), which cannot be guessed. Analyses are never listed publicly. This is the same model as "anyone with the link" sharing.
- **Finding your analyses again:** the browser keeps a list in `localStorage` (`id`, file name, date, delete token). The upload page shows it as "Meine Analysen". The file name stays in the browser and is never sent to the server.
- **Deleting early:** when an analysis is created, the API returns a random delete token once and stores only its hash. `DELETE /analyses/<id>` with the token removes the DynamoDB item and the extracted text. Without the token (other browser, cleared storage) the analysis is deleted automatically after 30 days.
- **Automatic deletion:** DynamoDB TTL and S3 lifecycle rules. Both run asynchronously; DynamoDB removes expired items typically within a few days. The API therefore treats an item with `ttl < now` as gone.
- **Static export:** Next.js `output: 'export'` cannot pre-render one page per analysis ID, so the result page is `/result?id=<id>` and loads the data on the client.

## Daily limit

- 3 analyses per client and day; the limit is counted when the upload URL is issued.
- The client is identified by IP address. Because the API sits behind CloudFront, `sourceIp` in the API Gateway event is a CloudFront address; the client IP comes from the `CloudFront-Viewer-Address` header, which CloudFront adds when the origin request policy forwards it.
- The IP is not stored. The key holds an HMAC of the IP with a secret from SSM Parameter Store, and the item expires after two days.
- The counter is increased with a conditional update (`attribute_not_exists(count) OR count < :limit`), so two parallel requests cannot both slip through.
- Order of checks for `POST /uploads`: captcha (Cloudflare Turnstile) → monthly budget → daily limit → presigned POST (max. 10 MB, PDF only).
- This is a soft limit: someone switching networks gets around it. The hard ceiling is the monthly budget.
- AWS WAF is not used: its rate-based rules count over minutes rather than a day, and it adds a fixed monthly cost.

## Cost control

Three layers, from fast and friendly to slow and hard:

1. **In the app (primary).** The Converse API returns token usage with every response. The analysis Lambda prices it with a pricing table in code (`pricing.ts`, per model and token type; Claude on Bedrock is billed via AWS Marketplace, so prices are configured rather than fetched), stores the cost on the analysis and adds it to the monthly budget item. Before issuing an upload URL and again before calling Bedrock, the API checks the budget; at 100 % new analyses are refused with a clear message. Sample analyses keep working.
2. **Limits on blast radius.** Reserved concurrency on the analysis Lambda (e.g. 2), `maxReceiveCount` on the queue, a maximum input size per request, API Gateway throttling.
3. **Account backstop.** An AWS budget with an alert and a budget action that attaches a `Deny bedrock:InvokeModel*` policy to the analysis role. Billing data arrives with a delay, so this only catches what layer 1 missed.

Because this app is the only caller of Bedrock in the account, counting in the app is enough. Bedrock model invocation logging is not needed for cost tracking here.

## LLM output

- The model answers in a fixed JSON schema (tool use / structured output) and the answer is validated with Zod. An invalid answer is retried once, then the analysis is marked as failed.
- Every clause needs a verbatim quote. Code searches for it in the extracted text (after whitespace normalisation) and stores its offsets; quotes that are not found are dropped and counted.
- Categories are fixed per contract type. Prompt and categories are versioned in the repo, and the version is stored with every analysis.
- The model ID is configuration (`MODEL_ID`), never hardcoded.

## Legal and privacy

- The tool gives general information, not legal advice, and says so above every result. It is free, rate-limited and positioned as a demo, which matters under the German Legal Services Act (RDG).
- Contracts contain personal data. Processing stays in `eu-central-1` (Bedrock through the EU inference profile), data is encrypted at rest, deleted after 30 days or on request, and contract content never appears in logs.
- Users are encouraged to use sample or redacted contracts. Privacy policy and legal notice go live with the public site.

## Timeline

| Phase | Dates | Outcome |
| --- | --- | --- |
| 1. Foundation | 26 Oct – 1 Nov | repo, CDK app, empty Next.js site live on CloudFront, deploy via GitHub Actions |
| 2. Pipeline | 2 – 12 Nov | presigned upload, text extraction, Bedrock call with validated output, quote verification, result and cost in DynamoDB |
| 3. Frontend | 9 – 22 Nov | all four pages per design, German and English, status polling, highlights |
| 4. Hardening | 20 – 27 Nov | captcha, daily limit, budget block, deletion, eval set and model comparison, error states, samples |
| 5. Launch | 27 – 30 Nov | README with architecture diagram, screenshots, short demo video |
