import { deleteTokenMatches } from '../domain/deleteToken';
import { AnalysisNotFoundError, InvalidDeleteTokenError } from '../domain/DomainError';
import type { DeletesAnalysis } from './adapters/DeletesAnalysis';
import type { DeletesPdf } from './adapters/DeletesPdf';
import type { DeletesText } from './adapters/DeletesText';
import type { GetsAnalysis } from './adapters/GetsAnalysis';
import type { ProvidesTime } from './adapters/ProvidesTime';
import type { UseCase } from './UseCase';

export interface DeleteAnalysisInput {
  analysisId: string;
  deleteToken: string;
}

export interface DeleteAnalysisAdapters {
  analysisStore: GetsAnalysis & DeletesAnalysis;
  documentStore: DeletesText & DeletesPdf;
  clock: ProvidesTime;
}

export class DeleteAnalysis implements UseCase<DeleteAnalysisInput, void> {
  constructor(private readonly a: DeleteAnalysisAdapters) {}

  async execute({ analysisId, deleteToken }: DeleteAnalysisInput): Promise<void> {
    const analysis = await this.a.analysisStore.get(analysisId);
    if (!analysis || analysis.isExpired(this.a.clock.now())) throw new AnalysisNotFoundError();
    if (!deleteTokenMatches(deleteToken, analysis.deleteTokenHash)) {
      throw new InvalidDeleteTokenError();
    }

    await this.a.documentStore.deleteText(analysisId);
    await this.a.documentStore.deletePdf(`uploads/${analysisId}.pdf`);
    await this.a.analysisStore.delete(analysisId);
  }
}
