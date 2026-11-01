import { createHmac } from 'node:crypto';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { LimitsRates } from '../application/adapters/LimitsRates';

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

export class DynamoRateLimiter implements LimitsRates {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly ipHashSecret: string,
  ) {}

  async tryConsume(clientIp: string, day: string, limit: number): Promise<boolean> {
    const clientKey = createHmac('sha256', this.ipHashSecret).update(clientIp).digest('hex');
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `RATE#${clientKey}#${day}`, SK: 'COUNT' },
          UpdateExpression: 'ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)',
          ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit',
          ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':limit': limit,
            ':ttl': Math.floor(Date.now() / 1000) + TWO_DAYS_SECONDS,
          },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }
}
