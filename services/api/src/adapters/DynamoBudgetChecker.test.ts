import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';
import { DynamoBudgetChecker } from './DynamoBudgetChecker';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') };
const LIMIT = 10_000_000;

function checker(item: Record<string, unknown> | undefined) {
  const keys: unknown[] = [];
  const db = {
    send: (command: { input: { Key: unknown } }) => {
      keys.push(command.input.Key);
      return Promise.resolve({ Item: item });
    },
  } as unknown as DynamoDBDocumentClient;
  return { keys, checker: new DynamoBudgetChecker(db, 'table', clock, LIMIT) };
}

describe('DynamoBudgetChecker', () => {
  it('treats a missing BUDGET#<month> item as 0 spent', async () => {
    const { checker: c, keys } = checker(undefined);
    expect(await c.hasRemainingBudget()).toBe(true);
    expect(keys).toEqual([{ PK: 'BUDGET#2026-11', SK: 'TOTAL' }]);
  });

  it('allows spending below the default limit', async () => {
    expect(await checker({ costMicroUsd: LIMIT - 1 }).checker.hasRemainingBudget()).toBe(true);
  });

  it('blocks at 100 %', async () => {
    expect(await checker({ costMicroUsd: LIMIT }).checker.hasRemainingBudget()).toBe(false);
  });

  it('prefers the limit stored on the item', async () => {
    const item = { costMicroUsd: 5, limitMicroUsd: 5 };
    expect(await checker(item).checker.hasRemainingBudget()).toBe(false);
  });

  it('adds the cost to the month total', async () => {
    const sent: { input: Record<string, unknown> }[] = [];
    const db = {
      send: (command: { input: Record<string, unknown> }) => {
        sent.push(command);
        return Promise.resolve({});
      },
    } as unknown as DynamoDBDocumentClient;
    await new DynamoBudgetChecker(db, 'table', clock, LIMIT).add(3850);
    expect(sent[0]?.input).toMatchObject({
      TableName: 'table',
      Key: { PK: 'BUDGET#2026-11', SK: 'TOTAL' },
      UpdateExpression: 'ADD costMicroUsd :cost',
      ExpressionAttributeValues: { ':cost': 3850 },
    });
  });
});
