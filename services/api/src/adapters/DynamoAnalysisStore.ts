import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { StoresAnalysis } from '../application/adapters/StoresAnalysis';
import type { Analysis } from '../domain/Analysis';
import { monthKey } from '../domain/policy';

export class DynamoAnalysisStore implements StoresAnalysis {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(analysis: Analysis): Promise<void> {
    const createdAt = analysis.createdAt.toISOString();
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `ANALYSIS#${analysis.id}`,
          SK: 'META',
          status: analysis.status,
          contractType: analysis.contractType,
          language: analysis.language,
          createdAt,
          deleteTokenHash: `sha256:${analysis.deleteTokenHash}`,
          GSI1PK: `MONTH#${monthKey(analysis.createdAt)}`,
          GSI1SK: createdAt,
          ttl: Math.floor(analysis.expiresAt.getTime() / 1000),
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }
}
