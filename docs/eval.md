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

