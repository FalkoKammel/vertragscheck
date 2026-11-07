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

export interface AnalysisProps {
  id: string;
  status: AnalysisStatus;
  contractType: ContractType;
  language: Language;
  createdAt: Date;
  expiresAt: Date;
  deleteTokenHash: string;
  clauses?: StoredClause[];
  quotesDropped?: number;
  usage?: Usage;
  costMicroUsd?: number;
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
  private _quotesDropped: number;
  private _usage?: Usage;
  private _costMicroUsd: number;
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
    this._quotesDropped = props.quotesDropped ?? 0;
    this._usage = props.usage;
    this._costMicroUsd = props.costMicroUsd ?? 0;
    this._failureReason = props.failureReason;
  }

  get status() {
    return this._status;
  }
  get clauses(): readonly StoredClause[] {
    return this._clauses;
  }
  get quotesDropped() {
    return this._quotesDropped;
  }
  get usage() {
    return this._usage;
  }
  get costMicroUsd() {
    return this._costMicroUsd;
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
    usage: Usage;
    costMicroUsd: number;
  }): void {
    if (this._status !== 'running') throw new InvalidStatusTransitionError(this._status, 'done');
    this._clauses = result.verification.clauses;
    this._quotesDropped = result.verification.dropped;
    this._usage = result.usage;
    this._costMicroUsd = result.costMicroUsd;
    this._status = 'done';
  }

  fail(reason: FailureReason, usage?: Usage, costMicroUsd = 0): void {
    if (this._status !== 'running') throw new InvalidStatusTransitionError(this._status, 'failed');
    this._failureReason = reason;
    this._usage = usage;
    this._costMicroUsd = costMicroUsd;
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
      quotesDropped: this._quotesDropped,
      usage: this._usage,
      costMicroUsd: this._costMicroUsd,
      failureReason: this._failureReason,
    };
  }
}
