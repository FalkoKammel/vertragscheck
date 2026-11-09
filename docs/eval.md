# Evaluation

Results of `pnpm --filter eval eval`, newest last.

## 2026-11-09 · eu.anthropic.claude-haiku-4-5-20251001-v1:0 · prompt v1

- Runs per contract: 3
- Contracts: 8, labels: 37 expected + 35 clean
- Commit: 8d55f454dff327a5f9b00c431534a50a08cda1cf

| Metric | Value |
| --- | --- |
| Recall (all labels) | 81 % (min 73, max 85; 75/93) |
| Recall critical | 79 % (min 71, max 84; 70/88) |
| Recall check | 100 % (min 100, max 100; 5/5) |
| Missed: seen but rated fine | 1 |
| Missed: not hit at all | 17 |
| Consistency (found in every run) | 78 % (29/37) |
| Level accuracy (found labels) | 92 % (69/75) |
| Category accuracy (found labels) | 95 % (71/75) |
| False alarms (clean labels) | 2 % (2/81) |
| Overcautious (clean labels) | 4 % (3/81) |
| Unverified quotes (of returned clauses) | 3 % (3/115) |
| Invalid clauses (of returned clauses) | 0 % (0/115) |
| Failed runs | 21 % (5/24) |
| Cost per analysis (mean / total) | $0.0106 / $0.2010 |
| Latency (mean / p95) | 5976 ms / 13273 ms |

### Misses and false alarms per contract

- employment-01: recall 100 % (2/2), false alarms 0 % (0/5), overcautious 0 % (0/5), failed runs 2
- employment-02: recall 86 % (18/21), false alarms 0 % (0/9), overcautious 0 % (0/9)
  - missed employment-02-non-compete-no-compensation in 3/3 runs (not hit)
- employment-03: recall 75 % (9/12), false alarms 0 % (0/12), overcautious 25 % (3/12)
  - missed employment-03-exclusion-period-written-form-no-intent in 3/3 runs (not hit)
- employment-04: recall 40 % (4/10), false alarms 0 % (0/10), overcautious 0 % (0/10), failed runs 1
  - missed employment-04-non-compete-low-compensation in 2/2 runs (not hit)
  - missed employment-04-exclusion-period-no-minimum-wage in 2/2 runs (seen but rated fine, not hit)
  - missed employment-04-double-written-form in 2/2 runs (not hit)
- rental-01: recall 100 % (6/6), false alarms 0 % (0/18), overcautious 0 % (0/18)
- rental-02: recall 100 % (24/24), false alarms 0 % (0/9), overcautious 0 % (0/9)
- rental-03: recall 25 % (2/8), false alarms 0 % (0/8), overcautious 0 % (0/8), failed runs 1
  - missed rental-03-termination-waiver-over-four-years in 2/2 runs (not hit)
  - missed rental-03-deposit-gross-rent in 2/2 runs (not hit)
  - missed rental-03-inspection-without-cause in 2/2 runs (not hit)
- rental-04: recall 100 % (10/10), false alarms 20 % (2/10), overcautious 0 % (0/10), failed runs 1
  - false alarm in 2 run(s): Die Mieterin übernimmt die Schönheitsreparaturen. Diese werden im Allg

