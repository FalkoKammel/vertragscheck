import {
  ConverseCommand,
  type BedrockRuntimeClient,
  type ToolConfiguration,
  type ToolInputSchema,
} from '@aws-sdk/client-bedrock-runtime';
import { z } from 'zod';
import type {
  AnalysisRequest,
  AnalysisResult,
  RunsAnalysis,
} from '../application/adapters/RunsAnalysis';
import { buildSystemPrompt } from '../application/prompts/buildSystemPrompt';
import type { ContractType, Usage } from '../domain/analysis';
import { employmentLlmClauseSchema, rentalLlmClauseSchema } from '../domain/schemas';

const TOOL_NAME = 'report_clauses';
const MAX_OUTPUT_TOKENS = 8192;

const outputSchemas = {
  rental: z.object({ clauses: z.array(rentalLlmClauseSchema) }),
  employment: z.object({ clauses: z.array(employmentLlmClauseSchema) }),
} satisfies Record<ContractType, z.ZodType>;

function toolConfig(contractType: ContractType): ToolConfiguration {
  // Round trip gives plain JSON, which is what the API expects as a document.
  const inputSchema = JSON.parse(
    JSON.stringify(z.toJSONSchema(outputSchemas[contractType])),
  ) as Record<string, ToolInputSchema.JsonMember['json']>;
  delete inputSchema.$schema;
  return {
    tools: [
      {
        toolSpec: {
          name: TOOL_NAME,
          description: 'Report all notable clauses found in the contract.',
          inputSchema: { json: inputSchema },
        },
      },
    ],
    toolChoice: { tool: { name: TOOL_NAME } },
  };
}

export class BedrockAnalyser implements RunsAnalysis {
  constructor(
    private readonly client: BedrockRuntimeClient,
    private readonly modelId: string,
  ) {}

  async analyse({ contractType, language, text }: AnalysisRequest): Promise<AnalysisResult> {
    const res = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: buildSystemPrompt(contractType, language) }],
        messages: [{ role: 'user', content: [{ text }] }],
        toolConfig: toolConfig(contractType),
        inferenceConfig: { maxTokens: MAX_OUTPUT_TOKENS, temperature: 0 },
      }),
    );

    // Prompt caching is not used (decision 026), so cache tokens are not mapped.
    const usage: Usage = {
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
    };
    const toolUse = res.output?.message?.content?.find(
      (b) => b.toolUse?.name === TOOL_NAME,
    )?.toolUse;
    const parsed = outputSchemas[contractType].safeParse(toolUse?.input);
    if (!parsed.success) return { ok: false, modelId: this.modelId, usage };
    return { ok: true, modelId: this.modelId, usage, clauses: parsed.data.clauses };
  }
}
