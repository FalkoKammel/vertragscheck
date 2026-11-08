import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';
import { Analysis, type ModelRun } from '../domain/analysis';
import { DynamoAnalysisStore } from './DynamoAnalysisStore';

const createdAt = new Date('2026-11-03T10:15:00Z');
const RUN: ModelRun = {
  modelId: 'model-1',
  promptVersion: 'v1',
  usage: { inputTokens: 1, outputTokens: 2 },
  costMicroUsd: 7,
  latencyMs: 900,
};
const expiresAt = new Date('2026-12-03T10:15:00Z');
const startedAt = new Date('2026-11-03T10:16:00Z');

function pending() {
  return new Analysis({
    id: 'a1',
    status: 'pending_upload',
    contractType: 'rental',
    language: 'de',
    createdAt,
    expiresAt,
    deleteTokenHash: 'abc',
  });
}

function fakeDb(getItem?: Record<string, unknown>) {
  const sent: { input: { Item?: Record<string, unknown> } }[] = [];
  const db = {
    send: (command: { input: { Item?: Record<string, unknown> } }) => {
      sent.push(command);
      return Promise.resolve({ Item: getItem });
    },
  } as unknown as DynamoDBDocumentClient;
  return { sent, store: new DynamoAnalysisStore(db, 'table') };
}

describe('DynamoAnalysisStore', () => {
  it('saves the item with keys, GSI1, ttl and a create-only condition', async () => {
    const { sent, store } = fakeDb();
    await store.save(pending());

    expect(sent[0]?.input).toMatchObject({
      TableName: 'table',
      ConditionExpression: 'attribute_not_exists(PK)',
      Item: {
        PK: 'ANALYSIS#a1',
        SK: 'META',
        status: 'pending_upload',
        contractType: 'rental',
        language: 'de',
        createdAt: '2026-11-03T10:15:00.000Z',
        deleteTokenHash: 'sha256:abc',
        GSI1PK: 'MONTH#2026-11',
        GSI1SK: '2026-11-03T10:15:00.000Z',
        ttl: Math.floor(expiresAt.getTime() / 1000),
      },
    });
  });

  it('returns undefined when there is no item', async () => {
    const { sent, store } = fakeDb();
    expect(await store.get('a1')).toBeUndefined();
    expect(sent[0]?.input).toMatchObject({ Key: { PK: 'ANALYSIS#a1', SK: 'META' } });
  });

  it('reads back what save wrote', async () => {
    const writer = fakeDb();
    await writer.store.save(pending());
    const item = writer.sent[0]?.input.Item;

    const loaded = await fakeDb(item).store.get('a1');
    expect(loaded?.toProps()).toEqual(pending().toProps());
  });

  it('round-trips an analysis with a run and dropped counters', async () => {
    const analysis = new Analysis({
      ...pending().toProps(),
      status: 'done',
      unverifiedQuotes: 2,
      invalidClauses: 3,
      run: RUN,
    });
    const writer = fakeDb();
    await writer.store.save(analysis);
    const item = writer.sent[0]?.input.Item;
    expect(item).toMatchObject({ run: RUN, unverifiedQuotes: 2, invalidClauses: 3 });
    expect(item).not.toHaveProperty('usage');
    expect(item).not.toHaveProperty('costMicroUsd');
    expect(item).not.toHaveProperty('quotes');

    const loaded = await fakeDb(item).store.get('a1');
    expect(loaded?.toProps()).toEqual(analysis.toProps());
  });

  it('round-trips startedAt', async () => {
    const analysis = new Analysis({ ...pending().toProps(), status: 'running', startedAt });
    const writer = fakeDb();
    await writer.store.save(analysis);
    const item = writer.sent[0]?.input.Item;
    expect(item).toMatchObject({ startedAt: '2026-11-03T10:16:00.000Z' });

    const loaded = await fakeDb(item).store.get('a1');
    expect(loaded?.startedAt).toEqual(startedAt);
  });

  it('writes no startedAt attribute before the analysis started', async () => {
    const writer = fakeDb();
    await writer.store.save(pending());
    expect(writer.sent[0]?.input.Item).not.toHaveProperty('startedAt');
  });

  it('loads an old running item without startedAt', async () => {
    const loaded = await fakeDb({
      PK: 'ANALYSIS#a1',
      SK: 'META',
      status: 'running',
      contractType: 'rental',
      language: 'de',
      createdAt: '2026-11-03T10:15:00.000Z',
      deleteTokenHash: 'sha256:abc',
      ttl: Math.floor(expiresAt.getTime() / 1000),
    }).store.get('a1');
    expect(loaded?.status).toBe('running');
    expect(loaded?.startedAt).toBeUndefined();
  });

  it('writes no run attribute when there is none', async () => {
    const writer = fakeDb();
    await writer.store.save(pending());
    expect(writer.sent[0]?.input.Item).not.toHaveProperty('run');
  });

  it('loads an old item with top-level usage and cost but no run', async () => {
    const loaded = await fakeDb({
      PK: 'ANALYSIS#a1',
      SK: 'META',
      status: 'done',
      contractType: 'rental',
      language: 'de',
      createdAt: '2026-11-03T10:15:00.000Z',
      deleteTokenHash: 'sha256:abc',
      usage: { inputTokens: 1, outputTokens: 2 },
      costMicroUsd: 5,
      ttl: Math.floor(expiresAt.getTime() / 1000),
    }).store.get('a1');
    expect(loaded?.run).toBeUndefined();
    expect(loaded?.unverifiedQuotes).toBe(0);
    expect(loaded?.invalidClauses).toBe(0);
  });

  it('loads an old item with quotes and schemaDropped and zeroes both counters', async () => {
    const loaded = await fakeDb({
      PK: 'ANALYSIS#a1',
      SK: 'META',
      status: 'done',
      contractType: 'rental',
      language: 'de',
      createdAt: '2026-11-03T10:15:00.000Z',
      deleteTokenHash: 'sha256:abc',
      quotes: { total: 5, dropped: 2 },
      schemaDropped: 3,
      ttl: Math.floor(expiresAt.getTime() / 1000),
    }).store.get('a1');
    expect(loaded?.unverifiedQuotes).toBe(0);
    expect(loaded?.invalidClauses).toBe(0);
  });

  it('reads items written before clauses existed', async () => {
    const loaded = await fakeDb({
      PK: 'ANALYSIS#a1',
      SK: 'META',
      status: 'pending_upload',
      contractType: 'rental',
      language: 'de',
      createdAt: '2026-11-03T10:15:00.000Z',
      deleteTokenHash: 'sha256:abc',
      ttl: Math.floor(expiresAt.getTime() / 1000),
    }).store.get('a1');
    expect(loaded?.toProps()).toEqual(pending().toProps());
  });

  it('throws on an invalid item', async () => {
    const { store } = fakeDb({ PK: 'ANALYSIS#a1', SK: 'META', status: 'bogus' });
    await expect(store.get('a1')).rejects.toThrow();
  });

  describe('saveResult', () => {
    it('updates only the result fields, and only while running', async () => {
      const sent: { input: Record<string, unknown> }[] = [];
      const db = {
        send: (command: { input: Record<string, unknown> }) => {
          sent.push(command);
          return Promise.resolve({});
        },
      } as unknown as DynamoDBDocumentClient;
      const analysis = new Analysis({ ...pending().toProps(), status: 'running' });
      analysis.fail('INVALID_PDF', RUN);
      await new DynamoAnalysisStore(db, 'table').saveResult(analysis);

      expect(sent[0]?.input).toMatchObject({
        Key: { PK: 'ANALYSIS#a1', SK: 'META' },
        ConditionExpression: '#status = :running',
        ExpressionAttributeValues: {
          ':running': 'running',
          ':status': 'failed',
          ':run': RUN,
          ':unverifiedQuotes': 0,
          ':invalidClauses': 0,
          ':failureReason': 'INVALID_PDF',
        },
      });
    });
  });

  describe('markRunning', () => {
    function updateDb(error?: Error) {
      const sent: { input: Record<string, unknown> }[] = [];
      const db = {
        send: (command: { input: Record<string, unknown> }) => {
          sent.push(command);
          return error ? Promise.reject(error) : Promise.resolve({});
        },
      } as unknown as DynamoDBDocumentClient;
      return { sent, store: new DynamoAnalysisStore(db, 'table') };
    }

    it('sets running if the analysis is pending_upload', async () => {
      const { sent, store } = updateDb();
      expect(await store.markRunning('a1', startedAt)).toBe(true);
      expect(sent[0]?.input).toMatchObject({
        Key: { PK: 'ANALYSIS#a1', SK: 'META' },
        UpdateExpression: 'SET #status = :running, startedAt = :startedAt',
        ConditionExpression: '#status = :pendingUpload',
        ExpressionAttributeValues: {
          ':running': 'running',
          ':pendingUpload': 'pending_upload',
          ':startedAt': '2026-11-03T10:16:00.000Z',
        },
      });
    });

    it('returns false when the condition fails', async () => {
      const error = new ConditionalCheckFailedException({ message: 'no', $metadata: {} });
      expect(await updateDb(error).store.markRunning('a1', startedAt)).toBe(false);
    });

    it('rethrows other errors', async () => {
      await expect(
        updateDb(new Error('throttled')).store.markRunning('a1', startedAt),
      ).rejects.toThrow('throttled');
    });
  });
});
