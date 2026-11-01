import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { ChecksMonthlyBudget } from '../application/adapters/ChecksMonthlyBudget';
import type { ProvidesTime } from '../application/adapters/ProvidesTime';
import { monthKey } from '../domain/policy';

const budgetItem = z.object({
  costMicroUsd: z.number(),
  limitMicroUsd: z.number().optional(),
});

export class DynamoBudgetChecker implements ChecksMonthlyBudget {
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
}
