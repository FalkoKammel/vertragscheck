import type { SQSEvent } from 'aws-lambda';
import { z } from 'zod';

const s3EventSchema = z.object({
  Records: z.array(z.object({ s3: z.object({ object: z.object({ key: z.string() }) }) })),
});

/** `uploads/<analysisId>.pdf` → `<analysisId>` */
function analysisIdFromKey(key: string): string | undefined {
  return /^uploads\/([^/]+)\.pdf$/.exec(key)?.[1];
}

// placeholder for the usecase
export function analysisHandler(event: SQSEvent): Promise<void> {
  for (const message of event.Records) {
    // S3 key names arrive URL-encoded in event notifications.
    const parsed = s3EventSchema.safeParse(JSON.parse(message.body));
    if (!parsed.success) {
      // E.g. the s3:TestEvent S3 sends when the notification is configured: acknowledge it.
      console.log(JSON.stringify({ msg: 'message ignored, not an S3 object event' }));
      continue;
    }
    for (const record of parsed.data.Records) {
      const key = decodeURIComponent(record.s3.object.key.replaceAll('+', ' '));
      console.log(
        JSON.stringify({ msg: 'upload received', key, analysisId: analysisIdFromKey(key) }),
      );
    }
  }
  return Promise.resolve();
}
