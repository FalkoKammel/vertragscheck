import { join } from 'node:path';

export const EVAL_DIR = join(import.meta.dirname, '..');
export const CONTRACTS_DIR = join(EVAL_DIR, 'contracts');
export const RESULTS_DIR = join(EVAL_DIR, 'results');
export const SUMMARY_FILE = join(EVAL_DIR, 'summary.json');
export const EVAL_DOC = join(EVAL_DIR, '..', 'docs', 'eval.md');
