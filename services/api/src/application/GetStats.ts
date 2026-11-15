import { aggregateMonthStats, type MonthStats } from '../domain/monthStats';
import { monthKey } from '../domain/policy';
import type { ListsMonthAnalyses } from './adapters/ListsMonthAnalyses';
import type { MonthBudget, ReadsMonthlyBudget } from './adapters/ReadsMonthlyBudget';
import type { ProvidesTime } from './adapters/ProvidesTime';
import type { UseCase } from './UseCase';

export interface GetStatsOutput {
  month: string;
  stats: MonthStats;
  budget: MonthBudget;
  activeModelId: string;
}

export interface GetStatsAdapters {
  analyses: ListsMonthAnalyses;
  budget: ReadsMonthlyBudget;
  clock: ProvidesTime;
  activeModelId: string;
}

export class GetStats implements UseCase<undefined, GetStatsOutput> {
  constructor(private readonly a: GetStatsAdapters) {}

  async execute(): Promise<GetStatsOutput> {
    const month = monthKey(this.a.clock.now());
    const [items, budget] = await Promise.all([
      this.a.analyses.listMonth(month),
      this.a.budget.getMonthBudget(month),
    ]);
    return {
      month,
      stats: aggregateMonthStats(items),
      budget,
      activeModelId: this.a.activeModelId,
    };
  }
}
