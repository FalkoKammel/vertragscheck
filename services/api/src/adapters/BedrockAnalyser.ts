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
import { buildSystemPrompt, PROMPT_VERSION } from '../application/prompts/buildSystemPrompt';
import type { ContractType, Usage } from '../domain/analysis';
import {
  employmentLlmClauseSchema,
  rentalLlmClauseSchema,
  type LlmClause,
} from '../domain/schemas';
import { jsonrepair } from 'jsonrepair';

const TOOL_NAME = 'report_clauses';
const MAX_OUTPUT_TOKENS = 8192;

const clauseSchemas = {
  rental: rentalLlmClauseSchema,
  employment: employmentLlmClauseSchema,
} satisfies Record<ContractType, z.ZodType>;

// Some models occasionally return the clauses array serialized as a JSON string
// inside the tool input, sometimes with unescaped quotes. Parse it, or repair and parse it.
// Repaired clauses still go through Zod and quote verification, so a bad repair is dropped there.
function parseIfJsonString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    console.warn('analysis clauses returned as JSON string, parsed');
    return parsed;
  } catch {
    try {
      const repaired: unknown = JSON.parse(jsonrepair(value));
      console.warn('analysis clauses returned as invalid JSON string, repaired');
      return repaired;
    } catch {
      console.warn('analysis clauses returned as invalid JSON string, repair failed', {
        length: value.length,
      });
      return value;
    }
  }
}

// Only checks the outer shape. Clauses are validated one by one, so a single
// bad clause does not throw away the whole analysis.
const envelopeSchema = z.object({
  clauses: z.preprocess(parseIfJsonString, z.array(z.unknown())),
});

function toolConfig(contractType: ContractType): ToolConfiguration {
  const outputSchema = z.object({ clauses: z.array(clauseSchemas[contractType]) });
  // Round trip gives plain JSON, which is what the API expects as a document
  const inputSchema = JSON.parse(JSON.stringify(z.toJSONSchema(outputSchema))) as Record<
    string,
    ToolInputSchema.JsonMember['json']
  >;
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

// Shape of the tool input for logging only: key names and types, never content.
function describeInput(input: unknown) {
  const clauses: unknown =
    input && typeof input === 'object' ? (input as Record<string, unknown>).clauses : undefined;
  return {
    inputKeys: input && typeof input === 'object' ? Object.keys(input) : typeof input,
    clausesType: Array.isArray(clauses) ? 'array' : typeof clauses,
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
        // Tags mark the contract as data; the system prompt tells the model to ignore instructions inside them.
        messages: [{ role: 'user', content: [{ text: `<contract>\n${text}\n</contract>` }] }],
        toolConfig: toolConfig(contractType),
        inferenceConfig: { maxTokens: MAX_OUTPUT_TOKENS, temperature: 0 },
      }),
    );

    // Prompt caching is not used (decision 026), so cache tokens are not mapped.
    const usage: Usage = {
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
    };
    const base = {
      modelId: this.modelId,
      promptVersion: PROMPT_VERSION,
      usage,
      latencyMs: res.metrics?.latencyMs ?? 0,
    };

    // Never log contract text or model output, only metadata.
    if (res.stopReason === 'max_tokens') {
      console.warn('analysis output truncated', { outputTokens: usage.outputTokens });
      return { ok: false, ...base };
    }

    const toolUse = res.output?.message?.content?.find(
      (b) => b.toolUse?.name === TOOL_NAME,
    )?.toolUse;
    const envelope = envelopeSchema.safeParse(toolUse?.input);
    if (!envelope.success) {
      console.warn('analysis output invalid', {
        stopReason: res.stopReason,
        hasToolUse: !!toolUse,
        ...describeInput(toolUse?.input),
      });
      return { ok: false, ...base };
    }

    const clauseSchema = clauseSchemas[contractType];
    const clauses: LlmClause[] = [];
    let invalidClauses = 0;
    for (const raw of envelope.data.clauses) {
      const parsed = clauseSchema.safeParse(raw);
      if (parsed.success) clauses.push(parsed.data);
      else invalidClauses++;
    }

    return { ok: true, ...base, clauses, invalidClauses };
  }
}
