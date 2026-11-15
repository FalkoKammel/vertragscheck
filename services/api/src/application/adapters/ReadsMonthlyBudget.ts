export interface MonthBudget {
  spentMicroUsd: number;
  limitMicroUsd: number;
}

export interface ReadsMonthlyBudget {
  getMonthBudget: (month: string) => Promise<MonthBudget>;
}
