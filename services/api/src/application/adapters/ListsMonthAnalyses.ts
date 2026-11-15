import type { MonthAnalysisSummary } from '../../domain/monthStats';

export interface ListsMonthAnalyses {
  listMonth: (month: string) => Promise<MonthAnalysisSummary[]>;
}
