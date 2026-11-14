import { employmentLlmClauseSchema, rentalLlmClauseSchema } from 'api/src/domain/schemas';
import { z } from 'zod';
import type { Contract } from './load';
import type { CallRecord } from './results.schema';

const llmClausesSchema = z.array(z.union([rentalLlmClauseSchema, employmentLlmClauseSchema]));

/**
 * Recomputes `verification` of every successful call from its recorded model clauses with the
 * current ContractText.verifyQuotes. Does not modify the input; calls of unknown contracts and
 * failed calls are returned unchanged.
 */
export function reverifyCalls(contracts: Contract[], calls: CallRecord[]): CallRecord[] {
  const byId = new Map(contracts.map((c) => [c.id, c]));
  return calls.map((call) => {
    const contract = byId.get(call.contractId);
    if (contract === undefined || call.result?.ok !== true) return call;
    const clauses = llmClausesSchema.safeParse(call.result.clauses);
    if (!clauses.success) {
      throw new Error(
        `${call.contractId} run ${String(call.run)}: recorded clauses no longer match the LLM clause schema`,
      );
    }
    return { ...call, verification: contract.text.verifyQuotes(clauses.data) };
  });
}
