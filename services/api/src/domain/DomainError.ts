export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CaptchaInvalidError extends DomainError {
  readonly code = 'CAPTCHA_INVALID';
  constructor() {
    super('Captcha verification failed');
  }
}

export class BudgetExhaustedError extends DomainError {
  readonly code = 'BUDGET_EXHAUSTED';
  constructor() {
    super('Monthly analysis budget is exhausted');
  }
}

export class DailyLimitReachedError extends DomainError {
  readonly code = 'DAILY_LIMIT_REACHED';
  constructor() {
    super('Daily analysis limit reached');
  }
}

export class InvalidStatusTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION';
  constructor(from: string, to: string) {
    super(`Cannot change analysis status from ${from} to ${to}`);
  }
}

export class NoTextLayerError extends DomainError {
  readonly code = 'NO_TEXT_LAYER';
  constructor() {
    super('The document has no usable text layer (likely a scanned PDF)');
  }
}

export class UnknownModelPriceError extends DomainError {
  readonly code = 'UNKNOWN_MODEL_PRICE';
  constructor(modelId: string) {
    super(`The modelId ${modelId} is not known`);
  }
}

export class AnalysisNotFoundError extends DomainError {
  readonly code = 'ANALYSIS_NOT_FOUND';
  constructor() {
    super('Analysis not found');
  }
}

export class InvalidPdfError extends DomainError {
  readonly code = 'INVALID_PDF';
  constructor() {
    super('The file is not a readable PDF (broken or encrypted)');
  }
}

export class TooManyPagesError extends DomainError {
  readonly code = 'TOO_MANY_PAGES';
  constructor() {
    super('The document has more pages than allowed');
  }
}

export class LlmInvalidOutputError extends DomainError {
  readonly code = 'LLM_INVALID_OUTPUT';
  constructor() {
    super('The model returned no usable clauses');
  }
}
