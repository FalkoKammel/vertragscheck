import type { SQSEvent } from 'aws-lambda';
import { z } from 'zod';
import type { AnalyseContractInput } from '../application/AnalyseContract';
import type { UseCase } from '../application/UseCase';

const s3EventSchema = z.object({
  Records: z.array(z.object({ s3: z.object({ object: z.object({ key: z.string() }) }) })),
});

/** `uploads/<analysisId>.pdf` → `<analysisId>` (key format of `RequestUpload`). */
function analysisIdFromKey(key: string): string | undefined {
  return /^uploads\/([^/]+)\.pdf$/.exec(key)?.[1];
}

export function createAnalysisHandler(analyseContract: UseCase<AnalyseContractInput, void>) {
  return async (event: SQSEvent): Promise<void> => {
    for (const message of event.Records) {
      const parsed = s3EventSchema.safeParse(JSON.parse(message.body));
      if (!parsed.success) {
        // E.g. the s3:TestEvent S3 sends when the notification is configured: acknowledge it.
        console.log(JSON.stringify({ msg: 'message ignored, not an S3 object event' }));
        continue;
      }
      for (const record of parsed.data.Records) {
        // S3 key names arrive URL-encoded in event notifications.
        const key = decodeURIComponent(record.s3.object.key.replaceAll('+', ' '));
        const analysisId = analysisIdFromKey(key);
        if (!analysisId) {
          console.log(JSON.stringify({ msg: 'object ignored, unexpected key', key }));
          continue;
        }
        const startedAt = Date.now();
        // Errors propagate so SQS retries the message and finally moves it to the DLQ.
        await analyseContract.execute({ analysisId, key });
        console.log(
          JSON.stringify({ msg: 'analysis finished', analysisId, ms: Date.now() - startedAt }),
        );
      }
    }
  };
}
