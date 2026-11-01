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
