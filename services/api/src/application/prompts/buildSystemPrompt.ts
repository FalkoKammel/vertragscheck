import type { ContractType, Language } from '../../domain/analysis';

// TODO(Falko): write the real system prompt. This is only a placeholder.
export function buildSystemPrompt(contractType: ContractType, language: Language): string {
  return `PLACEHOLDER: analyse this ${contractType} contract and answer in ${language}.`;
}
