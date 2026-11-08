import { ContractText } from '../domain/ContractText';
import {
  BudgetExhaustedError,
  DomainError,
  InvalidPdfError,
  LlmInvalidOutputError,
  NoTextLayerError,
  TooManyPagesError,
} from '../domain/DomainError';
import type { FailureReason, ModelRun } from '../domain/analysis';
import { calculateCostMicroUsd } from '../domain/pricing';
import { MAX_PDF_PAGES } from '../domain/policy';
import type { AddsBudget } from './adapters/AddsBudget';
import type { ChecksMonthlyBudget } from './adapters/ChecksMonthlyBudget';
import type { DeletesPdf } from './adapters/DeletesPdf';
import type { ExtractsText } from './adapters/ExtractsText';
import type { GetsAnalysis } from './adapters/GetsAnalysis';
import type { GetsPdfFile } from './adapters/GetsPdfFile';
import type { MarksAnalysisRunning } from './adapters/MarksAnalysisRunning';
import type { ProvidesTime } from './adapters/ProvidesTime';
import type { PutsText } from './adapters/PutsText';
import type { RunsAnalysis } from './adapters/RunsAnalysis';
import type { StoresAnalysisResult } from './adapters/StoresAnalysisResult';
import type { UseCase } from './UseCase';

export interface AnalyseContractInput {
  analysisId: string;
  key: string;
}

export interface AnalyseContractAdapters {
  analysisStore: GetsAnalysis & MarksAnalysisRunning & StoresAnalysisResult;
  documentStore: GetsPdfFile & PutsText & DeletesPdf;
  textExtractor: ExtractsText;
  budget: ChecksMonthlyBudget & AddsBudget;
  analyser: RunsAnalysis;
  clock: ProvidesTime;
}

export class AnalyseContract implements UseCase<AnalyseContractInput, void> {
  constructor(private readonly a: AnalyseContractAdapters) {}

  async execute({ analysisId, key }: AnalyseContractInput): Promise<void> {
    const analysis = await this.a.analysisStore.get(analysisId);
    const now = this.a.clock.now();
    if (!analysis || analysis.isExpired(now)) return;
    if (!(await this.a.analysisStore.markRunning(analysisId, now))) return;
    analysis.start(now);

    let run: ModelRun | undefined;
    try {
      if (!(await this.a.budget.hasRemainingBudget())) throw new BudgetExhaustedError();

      const pages = await this.a.textExtractor.extract(await this.a.documentStore.getPdf(key)); // InvalidPdfError
      if (pages.length > MAX_PDF_PAGES) throw new TooManyPagesError();
      const text = ContractText.fromExtracted(pages);
      text.assertHasTextLayer(pages.length);
      await this.a.documentStore.putText(analysisId, text.value);

      const result = await this.a.analyser.analyse({
        contractType: analysis.contractType,
        language: analysis.language,
        text: text.value,
      });
      const costMicroUsd = calculateCostMicroUsd(result.modelId, result.usage);
      run = {
        modelId: result.modelId,
        promptVersion: result.promptVersion,
        usage: result.usage,
        costMicroUsd,
        latencyMs: result.latencyMs,
      };
      await this.a.budget.add(costMicroUsd);
      if (!result.ok) throw new LlmInvalidOutputError();

      const verification = text.verifyQuotes(result.clauses);
      const returned = result.clauses.length + result.invalidClauses;
      if (returned > 0 && verification.clauses.length === 0) throw new LlmInvalidOutputError();

      analysis.complete({ verification, invalidClauses: result.invalidClauses, run });
    } catch (err) {
      analysis.fail(toFailureReason(err), run);
      if (!(err instanceof DomainError))
        console.error('analysis failed', {
          analysisId,
          name: err instanceof Error ? err.name : typeof err,
        });
    } finally {
      await this.a.documentStore.deletePdf(key);
    }
    await this.a.analysisStore.saveResult(analysis);
  }
}

export function toFailureReason(err: unknown): FailureReason {
  if (err instanceof BudgetExhaustedError) return 'BUDGET_EXHAUSTED';
  if (err instanceof InvalidPdfError) return 'INVALID_PDF';
  if (err instanceof TooManyPagesError) return 'TOO_MANY_PAGES';
  if (err instanceof NoTextLayerError) return 'NO_TEXT_LAYER';
  if (err instanceof LlmInvalidOutputError) return 'LLM_INVALID_OUTPUT';
  return 'INTERNAL';
}
