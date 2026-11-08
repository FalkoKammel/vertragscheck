import type { Analysis, EffectiveStatus } from '../domain/analysis';
import { AnalysisNotFoundError } from '../domain/DomainError';
import type { GetsAnalysis } from './adapters/GetsAnalysis';
import type { GetsText } from './adapters/GetsText';
import type { ProvidesTime } from './adapters/ProvidesTime';
import type { UseCase } from './UseCase';

export interface GetAnalysisInput {
  analysisId: string;
}

export interface GetAnalysisOutput extends EffectiveStatus {
  analysis: Analysis;
  /** Only present when the effective status is `done`. */
  text?: string;
}

export interface GetAnalysisAdapters {
  analysisStore: GetsAnalysis;
  textStore: GetsText;
  clock: ProvidesTime;
}

export class GetAnalysis implements UseCase<GetAnalysisInput, GetAnalysisOutput> {
  constructor(private readonly a: GetAnalysisAdapters) {}

  async execute({ analysisId }: GetAnalysisInput): Promise<GetAnalysisOutput> {
    const now = this.a.clock.now();
    const analysis = await this.a.analysisStore.get(analysisId);
    // Unknown, deleted and expired look the same, so the API does not reveal that an ID existed.
    if (!analysis || analysis.isExpired(now)) throw new AnalysisNotFoundError();

    const effective = analysis.effectiveStatus(now);
    if (effective.status !== 'done') return { analysis, ...effective };

    const text = await this.a.textStore.getText(analysisId);
    if (text === undefined || !analysis.run) {
      return { analysis, status: 'failed', failureReason: 'INTERNAL' };
    }
    return { analysis, status: 'done', text };
  }
}
