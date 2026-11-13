import { ContractText } from '../domain/ContractText';
import {
  BudgetExhaustedError,
  DomainError,
  InvalidPdfError,
  LlmInvalidOutputError,
  NoTextLayerError,
  TooManyPagesError,
} from '../domain/DomainError';
import type { Analysis, FailureReason, ModelRun, Usage } from '../domain/analysis';
import { calculateCostMicroUsd } from '../domain/pricing';
import { MAX_PDF_PAGES } from '../domain/policy';
import type { AddsBudget } from './adapters/AddsBudget';
import type { ChecksMonthlyBudget } from './adapters/ChecksMonthlyBudget';
import type { DeletesPdf } from './adapters/DeletesPdf';
import type { ExtractsText } from './adapters/ExtractsText';
import type { GetsAnalysis } from './adapters/GetsAnalysis';
import type { GetsPdfFile } from './adapters/GetsPdfFile';
import type { MarksAnalysisRunning } from './adapters/MarksAnalysisRunning';
import type { MarksAnalysisStage } from './adapters/MarksAnalysisStage';
import type { ProvidesTime } from './adapters/ProvidesTime';
import type { PutsText } from './adapters/PutsText';
import type { AnalysisResult, RunsAnalysis } from './adapters/RunsAnalysis';
import type { StoresAnalysisResult } from './adapters/StoresAnalysisResult';
import type { UseCase } from './UseCase';

export interface AnalyseContractInput {
  analysisId: string;
  key: string;
}

export interface AnalyseContractOutput {
  status: Analysis['status'];
  failureReason?: FailureReason;
}

export interface AnalyseContractAdapters {
  analysisStore: GetsAnalysis & MarksAnalysisRunning & MarksAnalysisStage & StoresAnalysisResult;
  documentStore: GetsPdfFile & PutsText & DeletesPdf;
  textExtractor: ExtractsText;
  budget: ChecksMonthlyBudget & AddsBudget;
  analyser: RunsAnalysis;
  clock: ProvidesTime;
}

export class AnalyseContract implements UseCase<
  AnalyseContractInput,
  AnalyseContractOutput | undefined
> {
  constructor(private readonly a: AnalyseContractAdapters) {}

  async execute({
    analysisId,
    key,
  }: AnalyseContractInput): Promise<AnalyseContractOutput | undefined> {
    const analysis = await this.a.analysisStore.get(analysisId);
    const now = this.a.clock.now();
    if (!analysis) {
      await this.a.documentStore.deletePdf(key);
      return;
    }
    if (analysis.isExpired(now)) return;
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

      if (!(await this.a.analysisStore.markStage(analysisId, 'analysing'))) {
        console.log({ msg: 'analysis deleted during run', analysisId });
        return;
      }
      analysis.setStage('analysing');
      const request = {
        contractType: analysis.contractType,
        language: analysis.language,
        text: text.value,
      };
      let result = await this.a.analyser.analyse(request);
      run = await this.bookRun(result, run);
      if (!result.ok && result.reason === 'invalid_output') {
        // The model sometimes returns a malformed tool output; at temperature 0 a second try
        // usually still differs enough to succeed. Truncation is not retried (same result).
        console.warn({ msg: 'analysis output invalid, retrying once', analysisId });
        result = await this.a.analyser.analyse(request);
        run = await this.bookRun(result, run);
      }
      if (!result.ok) throw new LlmInvalidOutputError();

      const verification = text.verifyQuotes(result.clauses);
      const returned = result.clauses.length + result.invalidClauses;
      if (returned > 0 && verification.clauses.length === 0) throw new LlmInvalidOutputError();

      analysis.complete({
        verification,
        invalidClauses: result.invalidClauses,
        pages: { starts: [...text.pageStarts], count: text.pageCount },
        run,
      });
    } catch (err) {
      analysis.fail(toFailureReason(err), run);
      if (!(err instanceof DomainError))
        console.error({
          msg: 'analysis failed',
          analysisId,
          name: err instanceof Error ? err.name : typeof err,
          // AWS SDK errors only: the message names the denied action and ARN, never contract content.
          ...(isAwsSdkError(err) ? { message: err.message } : {}),
        });
    } finally {
      await this.a.documentStore.deletePdf(key);
    }
    if (!(await this.a.analysisStore.saveResult(analysis))) {
      console.log({ msg: 'analysis deleted during run', analysisId });
      return;
    }
    return { status: analysis.status, failureReason: analysis.failureReason };
  }

  /** Books the cost of one model call and returns the run summed over all calls so far. */
  private async bookRun(result: AnalysisResult, previous: ModelRun | undefined): Promise<ModelRun> {
    const costMicroUsd = calculateCostMicroUsd(result.modelId, result.usage);
    await this.a.budget.add(costMicroUsd);
    const usage: Usage = {
      inputTokens: (previous?.usage.inputTokens ?? 0) + result.usage.inputTokens,
      outputTokens: (previous?.usage.outputTokens ?? 0) + result.usage.outputTokens,
    };
    return {
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      usage,
      costMicroUsd: (previous?.costMicroUsd ?? 0) + costMicroUsd,
      latencyMs: (previous?.latencyMs ?? 0) + result.latencyMs,
    };
  }
}

function isAwsSdkError(err: unknown): err is Error {
  return err instanceof Error && '$metadata' in err;
}

export function toFailureReason(err: unknown): FailureReason {
  if (err instanceof BudgetExhaustedError) return 'BUDGET_EXHAUSTED';
  if (err instanceof InvalidPdfError) return 'INVALID_PDF';
  if (err instanceof TooManyPagesError) return 'TOO_MANY_PAGES';
  if (err instanceof NoTextLayerError) return 'NO_TEXT_LAYER';
  if (err instanceof LlmInvalidOutputError) return 'LLM_INVALID_OUTPUT';
  return 'INTERNAL';
}
