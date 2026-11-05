import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';
import { Analysis } from '../domain/analysis';
import { DynamoAnalysisStore } from './DynamoAnalysisStore';

const createdAt = new Date('2026-11-03T10:15:00Z');
const expiresAt = new Date('2026-12-03T10:15:00Z');

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
});
