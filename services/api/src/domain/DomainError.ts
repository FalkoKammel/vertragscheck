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
