import type { SQSEvent } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalyseContractInput } from '../application/AnalyseContract';
import { createAnalysisHandler } from './AnalysisHandler';

const sqsEvent = (body: unknown): SQSEvent =>
  ({ Records: [{ body: JSON.stringify(body) }] }) as SQSEvent;

const s3Event = (key: string) => ({ Records: [{ s3: { object: { key, size: 10 } } }] });

function setup(fail?: Error) {
  const calls: AnalyseContractInput[] = [];
  const handler = createAnalysisHandler({
    execute: (input) => {
      calls.push(input);
      return fail ? Promise.reject(fail) : Promise.resolve();
    },
  });
  return { calls, handler };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('analysisHandler', () => {
  it('runs the use case with the analysis id and key of an upload', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { calls, handler } = setup();
    await handler(sqsEvent(s3Event('uploads/abc-123.pdf')));
    expect(calls).toEqual([{ analysisId: 'abc-123', key: 'uploads/abc-123.pdf' }]);
  });

  it('decodes URL-encoded keys', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { calls, handler } = setup();
    await handler(sqsEvent(s3Event('uploads/a%2Db.pdf')));
    expect(calls).toEqual([{ analysisId: 'a-b', key: 'uploads/a-b.pdf' }]);
  });

  it('acknowledges the s3:TestEvent without running the use case', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { calls, handler } = setup();
    await expect(
      handler(
        sqsEvent({ Service: 'Amazon S3', Event: 's3:TestEvent', Bucket: 'b', RequestId: 'r' }),
      ),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([]);
    expect(String(log.mock.calls[0]?.[0])).toContain('message ignored');
  });

  it('ignores keys that do not match the upload key format', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { calls, handler } = setup();
    await handler(sqsEvent(s3Event('texts/abc.txt')));
    expect(calls).toEqual([]);
  });

  it('lets errors through so SQS retries the message', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { handler } = setup(new Error('dynamo down'));
    await expect(handler(sqsEvent(s3Event('uploads/abc.pdf')))).rejects.toThrow('dynamo down');
  });
});
