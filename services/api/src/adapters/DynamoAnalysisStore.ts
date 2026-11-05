import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { StoresAnalysis } from '../application/adapters/StoresAnalysis';
import {
  Analysis,
  ANALYSIS_STATUSES,
  CONTRACT_TYPES,
  FAILURE_REASONS,
  LANGUAGES,
} from '../domain/analysis';
import { monthKey } from '../domain/policy';
import { storedClauseSchema } from '../domain/schemas';

const HASH_PREFIX = 'sha256:';

const analysisItemSchema = z.object({
  status: z.enum(ANALYSIS_STATUSES),
  contractType: z.enum(CONTRACT_TYPES),
  language: z.enum(LANGUAGES),
  createdAt: z.iso.datetime(),
  deleteTokenHash: z.string().startsWith(HASH_PREFIX),
  ttl: z.number().int().nonnegative(),
  clauses: z.array(storedClauseSchema).optional(),
  quotes: z.object({ total: z.number().int(), dropped: z.number().int() }).optional(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }).optional(),
  costMicroUsd: z.number().int().optional(),
  failureReason: z.enum(FAILURE_REASONS).optional(),
});

export class DynamoAnalysisStore implements StoresAnalysis {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(analysis: Analysis): Promise<void> {
    const props = analysis.toProps();
    const clauses = props.clauses ?? [];
    const dropped = props.quotesDropped ?? 0;
    const createdAt = props.createdAt.toISOString();
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `ANALYSIS#${props.id}`,
          SK: 'META',
          status: props.status,
          contractType: props.contractType,
          language: props.language,
          createdAt,
          deleteTokenHash: `${HASH_PREFIX}${props.deleteTokenHash}`,
          clauses,
          quotes: { total: clauses.length + dropped, dropped },
          costMicroUsd: props.costMicroUsd ?? 0,
          ...(props.usage ? { usage: props.usage } : {}),
          ...(props.failureReason ? { failureReason: props.failureReason } : {}),
          GSI1PK: `MONTH#${monthKey(props.createdAt)}`,
          GSI1SK: createdAt,
          ttl: Math.floor(props.expiresAt.getTime() / 1000),
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async get(id: string): Promise<Analysis | undefined> {
    const { Item } = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `ANALYSIS#${id}`, SK: 'META' },
      }),
    );
    if (!Item) return undefined;

    const item = analysisItemSchema.parse(Item);
    return new Analysis({
      id,
      status: item.status,
      contractType: item.contractType,
      language: item.language,
      createdAt: new Date(item.createdAt),
      expiresAt: new Date(item.ttl * 1000),
      deleteTokenHash: item.deleteTokenHash.slice(HASH_PREFIX.length),
      clauses: item.clauses,
      quotesDropped: item.quotes?.dropped,
      usage: item.usage,
      costMicroUsd: item.costMicroUsd,
      failureReason: item.failureReason,
    });
  }
}
