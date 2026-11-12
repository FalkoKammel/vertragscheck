import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it } from 'vitest';
import { PROMPT_VERSION } from '../application/prompts/buildSystemPrompt';
import { BedrockAnalyser } from './BedrockAnalyser';

const MODEL = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';
const usage = { inputTokens: 100, outputTokens: 20 };

function analyser(response: unknown) {
  const sent: { input: Record<string, unknown> }[] = [];
  const client = {
    send: (command: { input: Record<string, unknown> }) => {
      sent.push(command);
      return Promise.resolve(response);
    },
  } as unknown as BedrockRuntimeClient;
  return { sent, analyser: new BedrockAnalyser(client, MODEL) };
}

const toolResponse = (input: unknown, name = 'report_clauses') => ({
  usage,
  metrics: { latencyMs: 321 },
  output: {
    message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't', name, input } }] },
  },
});

const request = { contractType: 'rental', language: 'de', text: 'Vertragstext' } as const;
const goodClause = { category: 'deposit', level: 'check', quote: 'Kaution', reason: 'Prüfen' };

describe('BedrockAnalyser', () => {
  it('sends the contract text with a forced report_clauses tool', async () => {
    const { sent, analyser: a } = analyser(toolResponse({ clauses: [] }));
    await a.analyse(request);

    const input = sent[0]?.input as {
      modelId: string;
      messages: { content: { text: string }[] }[];
      toolConfig: {
        toolChoice: unknown;
        tools: { toolSpec: { name: string; inputSchema: { json: Record<string, unknown> } } }[];
      };
    };
    expect(input.modelId).toBe(MODEL);
    expect(input.messages[0]?.content[0]?.text).toBe('<contract>\nVertragstext\n</contract>');
    expect(input.toolConfig.toolChoice).toEqual({ tool: { name: 'report_clauses' } });
    const schema = input.toolConfig.tools[0]?.toolSpec.inputSchema.json;
    expect(input.toolConfig.tools[0]?.toolSpec.name).toBe('report_clauses');
    expect(schema).toMatchObject({ type: 'object', required: ['clauses'] });
    expect(schema).not.toHaveProperty('$schema');
    expect(JSON.stringify(schema)).toContain('operating_costs');
    expect(JSON.stringify(schema)).not.toContain('non_compete');
  });

  it('uses the employment categories for employment contracts', async () => {
    const { sent, analyser: a } = analyser(toolResponse({ clauses: [] }));
    await a.analyse({ ...request, contractType: 'employment' });
    expect(JSON.stringify(sent[0]?.input)).toContain('non_compete');
  });

  it('returns validated clauses and usage', async () => {
    const { analyser: a } = analyser(toolResponse({ clauses: [goodClause] }));
    expect(await a.analyse(request)).toEqual({
      ok: true,
      modelId: MODEL,
      promptVersion: PROMPT_VERSION,
      usage,
      latencyMs: 321,
      clauses: [goodClause],
      invalidClauses: 0,
    });
  });

  it('keeps valid clauses and counts the invalid one', async () => {
    const bad = { ...goodClause, category: 'non_compete' };
    const { analyser: a } = analyser(toolResponse({ clauses: [goodClause, bad] }));
    expect(await a.analyse(request)).toMatchObject({
      ok: true,
      clauses: [goodClause],
      invalidClauses: 1,
    });
  });

  it('returns ok: false with the run data when the output hit max_tokens', async () => {
    const { analyser: a } = analyser({
      ...toolResponse({ clauses: [goodClause] }),
      stopReason: 'max_tokens',
    });
    expect(await a.analyse(request)).toEqual({
      ok: false,
      reason: 'truncated',
      modelId: MODEL,
      promptVersion: PROMPT_VERSION,
      usage,
      latencyMs: 321,
    });
  });

  it('returns ok: false when the tool was not called', async () => {
    const { analyser: a } = analyser({
      usage,
      output: { message: { role: 'assistant', content: [{ text: 'Sorry' }] } },
    });
    expect(await a.analyse(request)).toMatchObject({
      ok: false,
      reason: 'invalid_output',
      modelId: MODEL,
      usage,
    });
  });

  it('returns ok: false when the tool input has no clauses array', async () => {
    const { analyser: a } = analyser(toolResponse({ foo: 1 }));
    expect(await a.analyse(request)).toMatchObject({ ok: false, reason: 'invalid_output' });
  });

  it('parses clauses that arrive as a JSON string', async () => {
    const { analyser: a } = analyser(toolResponse({ clauses: JSON.stringify([goodClause]) }));
    expect(await a.analyse(request)).toMatchObject({
      ok: true,
      clauses: [goodClause],
      invalidClauses: 0,
    });
  });

  it('repairs a JSON string with unescaped quotes inside a value', async () => {
    const broken =
      '[{"category":"deposit","level":"check","quote":"Die Kaution "kann" erhöht werden","reason":"Prüfen"}]';
    const { analyser: a } = analyser(toolResponse({ clauses: broken }));
    const result = await a.analyse(request);
    expect(result).toMatchObject({ ok: true, invalidClauses: 0 });
    expect(result.ok && result.clauses[0]?.quote).toBe('Die Kaution "kann" erhöht werden');
  });

  it('returns ok: false when the clauses string cannot be repaired', async () => {
    const { analyser: a } = analyser(toolResponse({ clauses: 'not json at all {' }));
    expect(await a.analyse(request)).toMatchObject({ ok: false, usage });
  });

  it('fixes a German quotation closed with a straight quote', async () => {
    const broken =
      '[{"category":"deposit","level":"check","quote":"Kaution","reason":"Die Klausel nennt „besenreinen Zustand", das ist üblich."}]';
    const { analyser: a } = analyser(toolResponse({ clauses: broken }));
    const result = await a.analyse(request);
    expect(result).toMatchObject({ ok: true, invalidClauses: 0 });
    expect(result.ok && result.clauses[0]?.reason).toBe(
      'Die Klausel nennt „besenreinen Zustand“, das ist üblich.',
    );
  });
});
