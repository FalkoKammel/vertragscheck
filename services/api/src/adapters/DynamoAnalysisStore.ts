import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { DeletesAnalysis } from '../application/adapters/DeletesAnalysis';
import type { StoresAnalysis } from '../application/adapters/StoresAnalysis';
import type { GetsAnalysis } from '../application/adapters/GetsAnalysis';
import type { StoresAnalysisResult } from '../application/adapters/StoresAnalysisResult';
import type { MarksAnalysisRunning } from '../application/adapters/MarksAnalysisRunning';
import type { MarksAnalysisStage } from '../application/adapters/MarksAnalysisStage';
import {
  Analysis,
  ANALYSIS_STAGES,
  ANALYSIS_STATUSES,
  CONTRACT_TYPES,
  FAILURE_REASONS,
  LANGUAGES,
  type AnalysisStage,
} from '../domain/analysis';
import { monthKey } from '../domain/policy';
import { storedClauseSchema } from '../domain/schemas';

const HASH_PREFIX = 'sha256:';

const runSchema = z.object({
  modelId: z.string(),
  promptVersion: z.string(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
  costMicroUsd: z.number().int(),
  latencyMs: z.number(),
});

const analysisItemSchema = z.object({
  status: z.enum(ANALYSIS_STATUSES),
  contractType: z.enum(CONTRACT_TYPES),
  language: z.enum(LANGUAGES),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().optional(),
  stage: z.enum(ANALYSIS_STAGES).optional(),
  deleteTokenHash: z.string().startsWith(HASH_PREFIX),
  ttl: z.number().int().nonnegative(),
  clauses: z.array(storedClauseSchema).optional(),
  unverifiedQuotes: z.number().int().default(0),
  invalidClauses: z.number().int().default(0),
  pageStarts: z.array(z.number().int().nonnegative()).optional(),
  pageCount: z.number().int().positive().optional(),
  run: runSchema.optional(),
  failureReason: z.enum(FAILURE_REASONS).optional(),
});

export class DynamoAnalysisStore
  implements
    StoresAnalysis,
    GetsAnalysis,
    MarksAnalysisRunning,
    MarksAnalysisStage,
    StoresAnalysisResult,
    DeletesAnalysis
{
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(analysis: Analysis): Promise<void> {
    const props = analysis.toProps();
    const clauses = props.clauses ?? [];
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
          ...(props.startedAt ? { startedAt: props.startedAt.toISOString() } : {}),
          ...(props.stage ? { stage: props.stage } : {}),
          deleteTokenHash: `${HASH_PREFIX}${props.deleteTokenHash}`,
          clauses,
          unverifiedQuotes: props.unverifiedQuotes ?? 0,
          invalidClauses: props.invalidClauses ?? 0,
          ...(props.pageStarts ? { pageStarts: props.pageStarts } : {}),
          ...(props.pageCount !== undefined ? { pageCount: props.pageCount } : {}),
          ...(props.run ? { run: props.run } : {}),
          ...(props.failureReason ? { failureReason: props.failureReason } : {}),
          GSI1PK: `MONTH#${monthKey(props.createdAt)}`,
          GSI1SK: createdAt,
          ttl: Math.floor(props.expiresAt.getTime() / 1000),
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async saveResult(analysis: Analysis): Promise<boolean> {
    const props = analysis.toProps();
    const clauses = props.clauses ?? [];
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `ANALYSIS#${props.id}`, SK: 'META' },
          UpdateExpression:
            'SET #status = :status, clauses = :clauses, unverifiedQuotes = :unverifiedQuotes, invalidClauses = :invalidClauses' +
            (props.pageStarts ? ', pageStarts = :pageStarts' : '') +
            (props.pageCount !== undefined ? ', pageCount = :pageCount' : '') +
            (props.run ? ', #run = :run' : '') +
            (props.failureReason ? ', failureReason = :failureReason' : '') +
            ' REMOVE stage',
          ConditionExpression: '#status = :running',
          ExpressionAttributeNames: {
            '#status': 'status',
            ...(props.run ? { '#run': 'run' } : {}),
          },
          ExpressionAttributeValues: {
            ':running': 'running',
            ':status': props.status,
            ':clauses': clauses,
            ':unverifiedQuotes': props.unverifiedQuotes ?? 0,
            ':invalidClauses': props.invalidClauses ?? 0,
            ...(props.pageStarts ? { ':pageStarts': props.pageStarts } : {}),
            ...(props.pageCount !== undefined ? { ':pageCount': props.pageCount } : {}),
            ...(props.run ? { ':run': props.run } : {}),
            ...(props.failureReason ? { ':failureReason': props.failureReason } : {}),
          },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }

  async delete(analysisId: string): Promise<void> {
    await this.db.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: `ANALYSIS#${analysisId}`, SK: 'META' },
      }),
    );
  }

  /** Returns false if the analysis is not waiting for its upload (duplicate event). */
  async markRunning(analysisId: string, startedAt: Date): Promise<boolean> {
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `ANALYSIS#${analysisId}`, SK: 'META' },
          UpdateExpression: 'SET #status = :running, startedAt = :startedAt, stage = :extracting',
          ConditionExpression: '#status = :pendingUpload',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':running': 'running',
            ':pendingUpload': 'pending_upload',
            ':startedAt': startedAt.toISOString(),
            ':extracting': 'extracting',
          },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }

  async markStage(analysisId: string, stage: AnalysisStage): Promise<boolean> {
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `ANALYSIS#${analysisId}`, SK: 'META' },
          UpdateExpression: 'SET stage = :stage',
          ConditionExpression: '#status = :running',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':stage': stage, ':running': 'running' },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
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
      startedAt: item.startedAt ? new Date(item.startedAt) : undefined,
      stage: item.stage,
      expiresAt: new Date(item.ttl * 1000),
      deleteTokenHash: item.deleteTokenHash.slice(HASH_PREFIX.length),
      clauses: item.clauses,
      unverifiedQuotes: item.unverifiedQuotes,
      invalidClauses: item.invalidClauses,
      pageStarts: item.pageStarts,
      pageCount: item.pageCount,
      run: item.run,
      failureReason: item.failureReason,
    });
  }
}
