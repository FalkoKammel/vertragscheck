import type { SQSEvent } from 'aws-lambda';
import { z } from 'zod';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BedrockAnalyser } from '../adapters/BedrockAnalyser';
import { DynamoAnalysisStore } from '../adapters/DynamoAnalysisStore';
import { DynamoBudgetStore } from '../adapters/DynamoBudgetStore';
import { S3DocumentStore } from '../adapters/S3DocumentStore';
import { SystemClock } from '../adapters/SystemClock';
import { UnpdfTextExtractor } from '../adapters/UnpdfTextExtractor';
import { AnalyseContract } from '../application/AnalyseContract';

const s3EventSchema = z.object({
  Records: z.array(z.object({ s3: z.object({ object: z.object({ key: z.string() }) }) })),
});

/** `uploads/<analysisId>.pdf` → `<analysisId>` (key format of `RequestUpload`). */
function analysisIdFromKey(key: string): string | undefined {
  return /^uploads\/([^/]+)\.pdf$/.exec(key)?.[1];
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const tableName = env('TABLE_NAME');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const clock = new SystemClock();

const analyseContract = new AnalyseContract({
  analysisStore: new DynamoAnalysisStore(db, tableName),
  documentStore: new S3DocumentStore(new S3Client({}), env('UPLOAD_BUCKET')),
  textExtractor: new UnpdfTextExtractor(),
  budget: new DynamoBudgetStore(db, tableName, clock, Number(env('BUDGET_LIMIT_MICRO_USD'))),
  analyser: new BedrockAnalyser(new BedrockRuntimeClient({}), env('MODEL_ID')),
  clock,
});

export async function analysisHandler(event: SQSEvent): Promise<void> {
  for (const message of event.Records) {
    const parsed = s3EventSchema.safeParse(JSON.parse(message.body));
    if (!parsed.success) {
      // E.g. the s3:TestEvent S3 sends when the notification is configured: acknowledge it.
      console.log({ msg: 'message ignored, not an S3 object event' });
      continue;
    }
    for (const record of parsed.data.Records) {
      // S3 key names arrive URL-encoded in event notifications.
      const key = decodeURIComponent(record.s3.object.key.replaceAll('+', ' '));
      const analysisId = analysisIdFromKey(key);
      if (!analysisId) {
        console.log({ msg: 'object ignored, unexpected key', key });
        continue;
      }
      const startedAt = Date.now();
      // Errors propagate so SQS retries the message and finally moves it to the DLQ.
      const outcome = await analyseContract.execute({ analysisId, key });
      console.log({
        msg: 'analysis finished',
        analysisId,
        // Undefined when the event was a duplicate or the analysis is unknown or expired.
        status: outcome?.status ?? 'skipped',
        failureReason: outcome?.failureReason,
        ms: Date.now() - startedAt,
      });
    }
  }
}
