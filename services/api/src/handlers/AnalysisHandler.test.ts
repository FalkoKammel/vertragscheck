import type { SQSEvent } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analysisHandler } from './AnalysisHandler';

const sqsEvent = (body: unknown): SQSEvent =>
  ({ Records: [{ body: JSON.stringify(body) }] }) as SQSEvent;

const logged = (spy: { mock: { calls: unknown[][] } }): string[] =>
  spy.mock.calls.map((call) => String(call[0]));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('analysisHandler', () => {
  it('logs the key and analysis id of an upload', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await analysisHandler(
      sqsEvent({ Records: [{ s3: { object: { key: 'uploads/abc-123.pdf', size: 10 } } }] }),
    );
    expect(logged(log)).toEqual([
      JSON.stringify({
        msg: 'upload received',
        key: 'uploads/abc-123.pdf',
        analysisId: 'abc-123',
      }),
    ]);
  });

  it('acknowledges the s3:TestEvent without throwing', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(
      analysisHandler(
        sqsEvent({ Service: 'Amazon S3', Event: 's3:TestEvent', Bucket: 'b', RequestId: 'r' }),
      ),
    ).resolves.toBeUndefined();
    expect(logged(log)).toEqual([
      JSON.stringify({ msg: 'message ignored, not an S3 object event' }),
    ]);
  });
});
