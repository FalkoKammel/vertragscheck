import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BedrockAnalyser } from '../adapters/BedrockAnalyser';
import { DynamoAnalysisStore } from '../adapters/DynamoAnalysisStore';
import { DynamoBudgetChecker } from '../adapters/DynamoBudgetChecker';
import { S3DocumentStore } from '../adapters/S3DocumentStore';
import { SystemClock } from '../adapters/SystemClock';
import { UnpdfTextExtractor } from '../adapters/UnpdfTextExtractor';
import { AnalyseContract } from '../application/AnalyseContract';
import { createAnalysisHandler } from './AnalysisHandler';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const tableName = env('TABLE_NAME');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const clock = new SystemClock();

export const analysisHandler = createAnalysisHandler(
  new AnalyseContract({
    analysisStore: new DynamoAnalysisStore(db, tableName),
    documentStore: new S3DocumentStore(new S3Client({}), env('UPLOAD_BUCKET')),
    textExtractor: new UnpdfTextExtractor(),
    budget: new DynamoBudgetChecker(db, tableName, clock, Number(env('BUDGET_LIMIT_MICRO_USD'))),
    analyser: new BedrockAnalyser(new BedrockRuntimeClient({}), env('MODEL_ID')),
    clock,
  }),
);
