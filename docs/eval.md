# Evaluation

Results of `pnpm --filter eval eval`, newest last.

## 2026-11-09 · eu.anthropic.claude-haiku-4-5-20251001-v1:0 · prompt v1

- Runs per contract: 3
- Contracts: 8, labels: 37 expected + 35 clean
- Commit: 17eafabc4070cbfd9c37130e5110f3ec4aab4a1b

| Metric | Value |
| --- | --- |
| Recall (all labels) | 78 % (min 78, max 78; 87/111) |
| Recall critical | 77 % (min 77, max 77; 81/105) |
| Recall check | 100 % (min 100, max 100; 6/6) |
| Missed: seen but rated fine | 3 |
| Missed: not hit at all | 21 |
| Consistency (found in every run) | 78 % (29/37) |
| Level accuracy (found labels) | 93 % (81/87) |
| Category accuracy (found labels) | 93 % (81/87) |
| False alarms (clean labels) | 3 % (3/105) |
| Overcautious (clean labels) | 3 % (3/105) |
| Unverified quotes (of returned clauses) | 2 % (3/152) |
| Invalid clauses (of returned clauses) | 0 % (0/152) |
| Failed runs | 0 % (0/24) |
| Cost per analysis (mean / total) | $0.0109 / $0.2627 |
| Latency (mean / p95) | 6435 ms / 11971 ms |

### Misses and false alarms per contract

- employment-01: recall 100 % (6/6), false alarms 0 % (0/15), overcautious 0 % (0/15)
- employment-02: recall 86 % (18/21), false alarms 0 % (0/9), overcautious 0 % (0/9)
  - missed employment-02-non-compete-no-compensation in 3/3 runs (not hit)
- employment-03: recall 75 % (9/12), false alarms 0 % (0/12), overcautious 25 % (3/12)
  - missed employment-03-exclusion-period-written-form-no-intent in 3/3 runs (not hit)
- employment-04: recall 40 % (6/15), false alarms 0 % (0/15), overcautious 0 % (0/15)
  - missed employment-04-non-compete-low-compensation in 3/3 runs (not hit)
  - missed employment-04-exclusion-period-no-minimum-wage in 3/3 runs (seen but rated fine)
  - missed employment-04-double-written-form in 3/3 runs (not hit)
- rental-01: recall 100 % (6/6), false alarms 0 % (0/18), overcautious 0 % (0/18)
- rental-02: recall 100 % (24/24), false alarms 0 % (0/9), overcautious 0 % (0/9)
- rental-03: recall 25 % (3/12), false alarms 0 % (0/12), overcautious 0 % (0/12)
  - missed rental-03-termination-waiver-over-four-years in 3/3 runs (not hit)
  - missed rental-03-deposit-gross-rent in 3/3 runs (not hit)
  - missed rental-03-inspection-without-cause in 3/3 runs (not hit)
- rental-04: recall 100 % (15/15), false alarms 20 % (3/15), overcautious 0 % (0/15)
  - false alarm in 3 run(s): Die Mieterin übernimmt die Schönheitsreparaturen. Diese werden im Allg

## 2026-11-10 · eu.anthropic.claude-haiku-4-5-20251001-v1:0 · prompt v2

- Runs per contract: 1
- Contracts: 8, labels: 37 expected + 35 clean
- Commit: aa6574cf16c0819c12c9346ed59c53487d22c59b

| Metric | Value |
| --- | --- |
| Recall (all labels) | 76 % (min 76, max 76; 28/37) |
| Recall critical | 74 % (min 74, max 74; 26/35) |
| Recall check | 100 % (min 100, max 100; 2/2) |
| Missed: seen but rated fine | 3 |
| Missed: not hit at all | 6 |
| Consistency (found in every run) | 76 % (28/37) |
| Level accuracy (found labels) | 82 % (23/28) |
| Category accuracy (found labels) | 93 % (26/28) |
| False alarms (clean labels) | 3 % (1/35) |
| Overcautious (clean labels) | 3 % (1/35) |
| Unverified quotes (of returned clauses) | 2 % (1/63) |
| Invalid clauses (of returned clauses) | 0 % (0/63) |
| Failed runs | 0 % (0/8) |
| Cost per analysis (mean / total) | $0.0124 / $0.0996 |
| Latency (mean / p95) | 7286 ms / 12165 ms |

### Misses and false alarms per contract

- employment-01: recall 100 % (2/2), false alarms 0 % (0/5), overcautious 0 % (0/5)
- employment-02: recall 86 % (6/7), false alarms 0 % (0/3), overcautious 0 % (0/3)
  - missed employment-02-non-compete-no-compensation in 1/1 runs (not hit)
- employment-03: recall 75 % (3/4), false alarms 0 % (0/4), overcautious 25 % (1/4)
  - missed employment-03-exclusion-period-written-form-no-intent in 1/1 runs (seen but rated fine)
- employment-04: recall 40 % (2/5), false alarms 0 % (0/5), overcautious 0 % (0/5)
  - missed employment-04-non-compete-low-compensation in 1/1 runs (not hit)
  - missed employment-04-exclusion-period-no-minimum-wage in 1/1 runs (not hit)
  - missed employment-04-double-written-form in 1/1 runs (not hit)
- rental-01: recall 50 % (1/2), false alarms 0 % (0/6), overcautious 0 % (0/6)
  - missed rental-01-minor-repairs-no-annual-cap in 1/1 runs (seen but rated fine)
- rental-02: recall 100 % (8/8), false alarms 0 % (0/3), overcautious 0 % (0/3)
- rental-03: recall 25 % (1/4), false alarms 0 % (0/4), overcautious 0 % (0/4)
  - missed rental-03-termination-waiver-over-four-years in 1/1 runs (not hit)
  - missed rental-03-deposit-gross-rent in 1/1 runs (seen but rated fine)
  - missed rental-03-inspection-without-cause in 1/1 runs (not hit)
- rental-04: recall 100 % (5/5), false alarms 20 % (1/5), overcautious 0 % (0/5)
  - false alarm in 1 run(s): Die Mieterin übernimmt die Schönheitsreparaturen. Diese werden im Allg

**Findings v2:** Not adopted. The language rule worked (no English phrases in German reasons). The rule "likely invalid → critical" backfired: for the non-compete clause the model softened the reason instead of raising the level, and level accuracy dropped from 93 % to 82 %. The "consider the whole contract" rule had no measurable effect. Next: v3 = v1 + language rule only.

## 2026-11-10 · eu.anthropic.claude-haiku-4-5-20251001-v1:0 · prompt v3

- Runs per contract: 1
- Contracts: 8, labels: 37 expected + 35 clean
- Commit: e7ed14ffbde2ec6c3aa4939f7c6034f6d7578062

| Metric | Value |
| --- | --- |
| Recall (all labels) | 73 % (min 73, max 73; 27/37) |
| Recall critical | 71 % (min 71, max 71; 25/35) |
| Recall check | 100 % (min 100, max 100; 2/2) |
| Missed: seen but rated fine | 3 |
| Missed: not hit at all | 7 |
| Consistency (found in every run) | 73 % (27/37) |
| Level accuracy (found labels) | 85 % (23/27) |
| Category accuracy (found labels) | 93 % (25/27) |
| False alarms (clean labels) | 3 % (1/35) |
| Overcautious (clean labels) | 3 % (1/35) |
| Unverified quotes (of returned clauses) | 2 % (1/66) |
| Invalid clauses (of returned clauses) | 0 % (0/66) |
| Failed runs | 0 % (0/8) |
| Cost per analysis (mean / total) | $0.0129 / $0.1033 |
| Latency (mean / p95) | 7572 ms / 11908 ms |

### Misses and false alarms per contract

- employment-01: recall 100 % (2/2), false alarms 0 % (0/5), overcautious 0 % (0/5)
- employment-02: recall 86 % (6/7), false alarms 0 % (0/3), overcautious 0 % (0/3)
  - missed employment-02-non-compete-no-compensation in 1/1 runs (not hit)
- employment-03: recall 75 % (3/4), false alarms 0 % (0/4), overcautious 25 % (1/4)
  - missed employment-03-exclusion-period-written-form-no-intent in 1/1 runs (seen but rated fine)
- employment-04: recall 20 % (1/5), false alarms 0 % (0/5), overcautious 0 % (0/5)
  - missed employment-04-repayment-employer-termination in 1/1 runs (not hit)
  - missed employment-04-non-compete-low-compensation in 1/1 runs (not hit)
  - missed employment-04-exclusion-period-no-minimum-wage in 1/1 runs (seen but rated fine)
  - missed employment-04-double-written-form in 1/1 runs (not hit)
- rental-01: recall 50 % (1/2), false alarms 0 % (0/6), overcautious 0 % (0/6)
  - missed rental-01-minor-repairs-no-annual-cap in 1/1 runs (seen but rated fine)
- rental-02: recall 100 % (8/8), false alarms 0 % (0/3), overcautious 0 % (0/3)
- rental-03: recall 25 % (1/4), false alarms 0 % (0/4), overcautious 0 % (0/4)
  - missed rental-03-termination-waiver-over-four-years in 1/1 runs (not hit)
  - missed rental-03-deposit-gross-rent in 1/1 runs (not hit)
  - missed rental-03-inspection-without-cause in 1/1 runs (not hit)
- rental-04: recall 100 % (5/5), false alarms 20 % (1/5), overcautious 0 % (0/5)
  - false alarm in 1 run(s): Die Mieterin übernimmt die Schönheitsreparaturen. Diese werden im Allg

**Findings v3:** Not adopted. The only difference to v1 is the output-language rule. It removed English phrases from German reasons, but recall dropped from 29/37 to 27/37 and level accuracy from 93 % to 85 %: the model rated more problem clauses as fine.

## 2026-11-10 · eu.anthropic.claude-haiku-4-5-20251001-v1:0 · prompt v1-rerun

- Runs per contract: 1
- Contracts: 8, labels: 37 expected + 35 clean
- Commit: e7ed14ffbde2ec6c3aa4939f7c6034f6d7578062

| Metric | Value |
| --- | --- |
| Recall (all labels) | 78 % (min 78, max 78; 29/37) |
| Recall critical | 77 % (min 77, max 77; 27/35) |
| Recall check | 100 % (min 100, max 100; 2/2) |
| Missed: seen but rated fine | 0 |
| Missed: not hit at all | 8 |
| Consistency (found in every run) | 78 % (29/37) |
| Level accuracy (found labels) | 93 % (27/29) |
| Category accuracy (found labels) | 93 % (27/29) |
| False alarms (clean labels) | 3 % (1/35) |
| Overcautious (clean labels) | 3 % (1/35) |
| Unverified quotes (of returned clauses) | 2 % (1/51) |
| Invalid clauses (of returned clauses) | 0 % (0/51) |
| Failed runs | 0 % (0/8) |
| Cost per analysis (mean / total) | $0.0109 / $0.0869 |
| Latency (mean / p95) | 6095 ms / 11898 ms |

### Misses and false alarms per contract

- employment-01: recall 100 % (2/2), false alarms 0 % (0/5), overcautious 0 % (0/5)
- employment-02: recall 86 % (6/7), false alarms 0 % (0/3), overcautious 0 % (0/3)
  - missed employment-02-non-compete-no-compensation in 1/1 runs (not hit)
- employment-03: recall 75 % (3/4), false alarms 0 % (0/4), overcautious 25 % (1/4)
  - missed employment-03-exclusion-period-written-form-no-intent in 1/1 runs (not hit)
- employment-04: recall 40 % (2/5), false alarms 0 % (0/5), overcautious 0 % (0/5)
  - missed employment-04-non-compete-low-compensation in 1/1 runs (not hit)
  - missed employment-04-exclusion-period-no-minimum-wage in 1/1 runs (not hit)
  - missed employment-04-double-written-form in 1/1 runs (not hit)
- rental-01: recall 100 % (2/2), false alarms 0 % (0/6), overcautious 0 % (0/6)
- rental-02: recall 100 % (8/8), false alarms 0 % (0/3), overcautious 0 % (0/3)
- rental-03: recall 25 % (1/4), false alarms 0 % (0/4), overcautious 0 % (0/4)
  - missed rental-03-termination-waiver-over-four-years in 1/1 runs (not hit)
  - missed rental-03-deposit-gross-rent in 1/1 runs (not hit)
  - missed rental-03-inspection-without-cause in 1/1 runs (not hit)
- rental-04: recall 100 % (5/5), false alarms 20 % (1/5), overcautious 0 % (0/5)
  - false alarm in 1 run(s): Die Mieterin übernimmt die Schönheitsreparaturen. Diese werden im Allg

**Findings v1 rerun:** Control run to rule out drift. Identical to the v1 run on 2026-11-09 (29/37, level accuracy 93 %, same cost per analysis), so the model is reproducible across days with this prompt and the v3 drop is caused by the prompt change. v1 stays in production.

## 2026-11-10 · eu.anthropic.claude-sonnet-4-6 · prompt v1

- Runs per contract: 1
- Contracts: 8, labels: 37 expected + 35 clean
- Commit: e7ed14ffbde2ec6c3aa4939f7c6034f6d7578062

| Metric | Value |
| --- | --- |
| Recall (all labels) | 92 % (min 92, max 92; 34/37) |
| Recall critical | 91 % (min 91, max 91; 32/35) |
| Recall check | 100 % (min 100, max 100; 2/2) |
| Missed: seen but rated fine | 0 |
| Missed: not hit at all | 3 |
| Consistency (found in every run) | 92 % (34/37) |
| Level accuracy (found labels) | 97 % (33/34) |
| Category accuracy (found labels) | 94 % (32/34) |
| False alarms (clean labels) | 9 % (3/35) |
| Overcautious (clean labels) | 11 % (4/35) |
| Unverified quotes (of returned clauses) | 4 % (3/79) |
| Invalid clauses (of returned clauses) | 0 % (0/79) |
| Failed runs | 0 % (0/8) |
| Cost per analysis (mean / total) | $0.0471 / $0.3765 |
| Latency (mean / p95) | 15970 ms / 26216 ms |

### Misses and false alarms per contract

- employment-01: recall 100 % (2/2), false alarms 0 % (0/5), overcautious 20 % (1/5)
- employment-02: recall 86 % (6/7), false alarms 0 % (0/3), overcautious 0 % (0/3)
  - missed employment-02-non-compete-no-compensation in 1/1 runs (not hit)
- employment-03: recall 100 % (4/4), false alarms 25 % (1/4), overcautious 25 % (1/4)
  - false alarm in 1 run(s): gilt die verlängerte Frist auch für eine Kündigung durch die Arbeitneh
- employment-04: recall 80 % (4/5), false alarms 20 % (1/5), overcautious 0 % (0/5)
  - missed employment-04-double-written-form in 1/1 runs (not hit)
  - false alarm in 1 run(s): gilt die verlängerte Frist auch für eine Kündigung durch den Arbeitneh
- rental-01: recall 100 % (2/2), false alarms 0 % (0/6), overcautious 0 % (0/6)
- rental-02: recall 100 % (8/8), false alarms 0 % (0/3), overcautious 0 % (0/3)
- rental-03: recall 75 % (3/4), false alarms 0 % (0/4), overcautious 25 % (1/4)
  - missed rental-03-inspection-without-cause in 1/1 runs (not hit)
- rental-04: recall 100 % (5/5), false alarms 20 % (1/5), overcautious 20 % (1/5)
  - false alarm in 1 run(s): Die Mieterin übernimmt die Schönheitsreparaturen. Diese werden im Allg

**Findings Sonnet 4.6 (prompt v1):** Same prompt as production, model swapped. Recall 34/37 vs 29/37 for Haiku 4.5, level accuracy 97 % vs 93 %, and no English phrases in German reasons. It found most of the problems Haiku missed with every prompt variant (rental-03 waiver and deposit, employment-04 non-compete and repayment), which points to model capability rather than prompt wording. Trade-offs: 3/35 false alarms vs 1/35 (two on the same notice-period clause), 4/35 overcautious vs 1/35, about 4.3x the cost ($0.047 vs $0.011) and about 2.6x the latency (p95 26 s vs 12 s). Sonnet occasionally returns the clauses as a JSON string with unescaped quotes (1 of 8 here); the adapter now repairs this, and repaired clauses still pass schema and quote verification. Decision on the production model pending.