import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { AddsBudget } from '../application/adapters/AddsBudget';
import type { ChecksMonthlyBudget } from '../application/adapters/ChecksMonthlyBudget';
import type { ProvidesTime } from '../application/adapters/ProvidesTime';
import { monthKey } from '../domain/policy';

const budgetItem = z.object({
  costMicroUsd: z.number(),
  limitMicroUsd: z.number().optional(),
});

export class DynamoBudgetStore implements ChecksMonthlyBudget, AddsBudget {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly clock: ProvidesTime,
    private readonly defaultLimitMicroUsd: number,
  ) {}

  async hasRemainingBudget(): Promise<boolean> {
    const res = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `BUDGET#${monthKey(this.clock.now())}`, SK: 'TOTAL' },
      }),
    );
    if (!res.Item) return true;
    const item = budgetItem.parse(res.Item);
    return item.costMicroUsd < (item.limitMicroUsd ?? this.defaultLimitMicroUsd);
  }

  async add(cost: number): Promise<void> {
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `BUDGET#${monthKey(this.clock.now())}`, SK: 'TOTAL' },
        UpdateExpression: 'ADD costMicroUsd :cost',
        ExpressionAttributeValues: { ':cost': cost },
      }),
    );
  }
}
