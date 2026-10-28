---
name: verify
description: Run the project's checks (typecheck, lint, tests, build, CDK synth) and report the results. Use before saying a task is done, before every commit, and whenever Falko asks to verify.
---

# Verify

A task is only done when these checks pass. Never report success without having run them in this session.

## Steps

1. See what changed: `git status` and `git diff --stat` (against `main` if on a feature branch: `git diff --stat main...HEAD`).
2. Run the full check from the repo root:
   ```bash
   pnpm verify        # typecheck, lint, tests and build for all packages
   ```
   If the `verify` script does not exist yet, run what exists of `pnpm typecheck`, `pnpm lint`, `pnpm test` and say which ones are missing.
3. If anything under `infra/` changed, also run:
   ```bash
   pnpm --filter infra cdk synth
   ```
   Do not run `cdk deploy`, `cdk destroy` or anything else that changes AWS resources.
4. If anything under `apps/web/` changed, make sure the static export builds (`pnpm --filter web build`) and that no hardcoded user-facing strings or hex colours were added in components (see CLAUDE.md).

## Rules

- Fix real failures in the code. Never make a check pass by deleting or skipping tests, loosening types (`any`, `@ts-ignore`, `as unknown as`), disabling lint rules or changing the check scripts. If you think a test or rule is wrong, stop and ask.
- If a check still fails after two honest attempts, stop and report what fails and what you tried.

## Report

End with a short table, one row per check: name, result (pass / fail / not run), and for failures the relevant part of the output. Then one sentence: ready to commit, or what is still open.
