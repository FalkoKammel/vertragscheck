import type { UseCase } from './UseCase';
import type { Analysis, ContractType, Language } from '../domain/Analysis';
import {
  BudgetExhaustedError,
  CaptchaInvalidError,
  DailyLimitReachedError,
} from '../domain/DomainError';
import {
  DAILY_LIMIT,
  MAX_UPLOAD_BYTES,
  UPLOAD_TTL_SECONDS,
  dayKey,
  expiresAt,
} from '../domain/policy';
import type { ChecksMonthlyBudget } from './adapters/ChecksMonthlyBudget';
import type { GeneratesId } from './adapters/GeneratesId';
import type { GeneratesToken } from './adapters/GeneratesToken';
import type { IssuesTicket, UploadTicket } from './adapters/IssuesTicket';
import type { LimitsRates } from './adapters/LimitsRates';
import type { ProvidesTime } from './adapters/ProvidesTime';
import type { StoresAnalysis } from './adapters/StoresAnalysis';
import type { VerifiesCaptcha } from './adapters/VerifiesCaptcha';

export interface RequestUploadInput {
  captchaToken: string;
  clientIp: string;
  contractType: ContractType;
  language: Language;
}

export interface RequestUploadOutput {
  analysisId: string;
  deleteToken: string;
  uploadTicket: UploadTicket;
}

export interface RequestUploadAdapters {
  rateLimiter: LimitsRates;
  captchaVerifier: VerifiesCaptcha;
  analysisStore: StoresAnalysis;
  budgetChecker: ChecksMonthlyBudget;
  uploadTicketIssuer: IssuesTicket;
  tokenGenerator: GeneratesToken;
  idGenerator: GeneratesId;
  clock: ProvidesTime;
}

export class RequestUpload implements UseCase<RequestUploadInput, RequestUploadOutput> {
  constructor(private readonly _adapters: RequestUploadAdapters) {}

  public async execute(input: RequestUploadInput): Promise<RequestUploadOutput> {
    const a = this._adapters;

    if (!(await a.captchaVerifier.verify(input.captchaToken, input.clientIp))) {
      throw new CaptchaInvalidError();
    }
    if (!(await a.budgetChecker.hasRemainingBudget())) {
      throw new BudgetExhaustedError();
    }
    const now = a.clock.now();
    if (!(await a.rateLimiter.tryConsume(input.clientIp, dayKey(now), DAILY_LIMIT))) {
      throw new DailyLimitReachedError();
    }

    const analysisId = a.idGenerator.generate();
    const deleteToken = a.tokenGenerator.generate();

    const analysis: Analysis = {
      id: analysisId,
      status: 'pending_upload',
      contractType: input.contractType,
      language: input.language,
      createdAt: now,
      expiresAt: expiresAt(now),
      deleteTokenHash: deleteToken.hash,
    };
    await a.analysisStore.save(analysis);

    const uploadTicket = await a.uploadTicketIssuer.issue({
      key: `uploads/${analysisId}.pdf`,
      maxBytes: MAX_UPLOAD_BYTES,
      expiresInSeconds: UPLOAD_TTL_SECONDS,
    });

    return { analysisId, deleteToken: deleteToken.token, uploadTicket };
  }
}
