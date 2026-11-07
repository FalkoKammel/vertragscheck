import type { StoredClause } from './schemas';
import type { QuoteVerificationResult } from './ContractText';
import { InvalidStatusTransitionError } from './DomainError';

export const ANALYSIS_STATUSES = ['pending_upload', 'running', 'done', 'failed'] as const;
export const CONTRACT_TYPES = ['rental', 'employment'] as const;
export const LANGUAGES = ['de', 'en'] as const;
export const FAILURE_REASONS = [
  'BUDGET_EXHAUSTED',
  'INVALID_PDF',
  'TOO_MANY_PAGES',
  'NO_TEXT_LAYER',
  'LLM_INVALID_OUTPUT',
  'INTERNAL',
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type Language = (typeof LANGUAGES)[number];
export type FailureReason = (typeof FAILURE_REASONS)[number];

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelRun {
  modelId: string;
  promptVersion: string;
  usage: Usage;
  costMicroUsd: number;
  latencyMs: number;
}

export interface AnalysisProps {
  id: string;
  status: AnalysisStatus;
  contractType: ContractType;
  language: Language;
  createdAt: Date;
  expiresAt: Date;
  deleteTokenHash: string;
  clauses?: StoredClause[];
  unverifiedQuotes?: number;
  invalidClauses?: number;
  run?: ModelRun;
  failureReason?: FailureReason;
}

export class Analysis {
  readonly id: string;
  readonly contractType: ContractType;
  readonly language: Language;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly deleteTokenHash: string;

  private _status: AnalysisStatus;
  private _clauses: StoredClause[];
  private _unverifiedQuotes: number;
  private _invalidClauses: number;
  private _run?: ModelRun;
  private _failureReason?: FailureReason;

  constructor(props: AnalysisProps) {
    this.id = props.id;
    this.contractType = props.contractType;
    this.language = props.language;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
    this.deleteTokenHash = props.deleteTokenHash;
    this._status = props.status;
    this._clauses = props.clauses ?? [];
    this._unverifiedQuotes = props.unverifiedQuotes ?? 0;
    this._invalidClauses = props.invalidClauses ?? 0;
    this._run = props.run;
    this._failureReason = props.failureReason;
  }

  get status() {
    return this._status;
  }
  get clauses(): readonly StoredClause[] {
    return this._clauses;
  }
  get unverifiedQuotes() {
    return this._unverifiedQuotes;
  }
  get invalidClauses() {
    return this._invalidClauses;
  }
  get run() {
    return this._run;
  }
  get failureReason() {
    return this._failureReason;
  }

  start(): void {
    if (this._status !== 'pending_upload')
      throw new InvalidStatusTransitionError(this._status, 'running');
    this._status = 'running';
  }

  complete(result: {
    verification: QuoteVerificationResult;
    invalidClauses: number;
    run: ModelRun;
  }): void {
    if (this._status !== 'running') throw new InvalidStatusTransitionError(this._status, 'done');
    this._clauses = result.verification.clauses;
    this._unverifiedQuotes = result.verification.unverifiedQuotes;
    this._invalidClauses = result.invalidClauses;
    this._run = result.run;
    this._status = 'done';
  }

  fail(reason: FailureReason, run?: ModelRun): void {
    if (this._status !== 'running') throw new InvalidStatusTransitionError(this._status, 'failed');
    this._failureReason = reason;
    this._run = run;
    this._status = 'failed';
  }

  isExpired(now: Date): boolean {
    return this.expiresAt <= now;
  }

  toProps(): AnalysisProps {
    return {
      id: this.id,
      status: this._status,
      contractType: this.contractType,
      language: this.language,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      deleteTokenHash: this.deleteTokenHash,
      clauses: [...this._clauses],
      unverifiedQuotes: this._unverifiedQuotes,
      invalidClauses: this._invalidClauses,
      run: this._run,
      failureReason: this._failureReason,
    };
  }
}
