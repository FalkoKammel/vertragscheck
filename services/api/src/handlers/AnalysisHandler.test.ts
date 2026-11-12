import type { SQSEvent } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalyseContractInput, AnalyseContractOutput } from '../application/AnalyseContract';

const sqsEvent = (body: unknown): SQSEvent =>
  ({ Records: [{ body: JSON.stringify(body) }] }) as SQSEvent;

const s3Event = (key: string) => ({ Records: [{ s3: { object: { key, size: 10 } } }] });

const execute = vi.hoisted(() =>
  vi.fn<(input: AnalyseContractInput) => Promise<AnalyseContractOutput | undefined>>(),
);

vi.mock('../application/AnalyseContract', () => ({
  AnalyseContract: class {
    execute = execute;
  },
}));

async function setup(fail?: Error) {
  vi.stubEnv('TABLE_NAME', 'table');
  vi.stubEnv('UPLOAD_BUCKET', 'bucket');
  vi.stubEnv('MODEL_ID', 'model');
  vi.stubEnv('BUDGET_LIMIT_MICRO_USD', '1000');
  vi.resetModules();
  execute.mockReset();
  if (fail) execute.mockRejectedValue(fail);
  else execute.mockResolvedValue(undefined);
  const { analysisHandler } = await import('./AnalysisHandler');
  return { handler: analysisHandler, execute };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('analysisHandler', () => {
  it('runs the use case with the analysis id and key of an upload', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { execute, handler } = await setup();
    await handler(sqsEvent(s3Event('uploads/abc-123.pdf')));
    expect(execute.mock.calls).toEqual([[{ analysisId: 'abc-123', key: 'uploads/abc-123.pdf' }]]);
  });

  it('logs status and failure reason when the analysis finished', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { execute, handler } = await setup();
    execute.mockResolvedValue({ status: 'failed', failureReason: 'LLM_INVALID_OUTPUT' });
    await handler(sqsEvent(s3Event('uploads/abc-123.pdf')));
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      msg: 'analysis finished',
      analysisId: 'abc-123',
      status: 'failed',
      failureReason: 'LLM_INVALID_OUTPUT',
    });
  });

  it('decodes URL-encoded keys', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { execute, handler } = await setup();
    await handler(sqsEvent(s3Event('uploads/a%2Db.pdf')));
    expect(execute.mock.calls).toEqual([[{ analysisId: 'a-b', key: 'uploads/a-b.pdf' }]]);
  });

  it('acknowledges the s3:TestEvent without running the use case', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { execute, handler } = await setup();
    await expect(
      handler(
        sqsEvent({ Service: 'Amazon S3', Event: 's3:TestEvent', Bucket: 'b', RequestId: 'r' }),
      ),
    ).resolves.toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
    expect(log.mock.calls[0]).toEqual([{ msg: 'message ignored, not an S3 object event' }]);
  });

  it('ignores keys that do not match the upload key format', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { execute, handler } = await setup();
    await handler(sqsEvent(s3Event('texts/abc.txt')));
    expect(execute).not.toHaveBeenCalled();
  });

  it('lets errors through so SQS retries the message', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { handler } = await setup(new Error('dynamo down'));
    await expect(handler(sqsEvent(s3Event('uploads/abc.pdf')))).rejects.toThrow('dynamo down');
  });
});
