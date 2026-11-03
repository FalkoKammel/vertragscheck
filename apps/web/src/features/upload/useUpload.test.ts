// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, S3UploadError } from '../../lib/api/errors';
import { useUpload, type UploadDeps } from './useUpload';

const file = new File(['%PDF'], 'mietvertrag.pdf', { type: 'application/pdf' });
const params = {
  file,
  captchaToken: 'token',
  contractType: 'rental',
  language: 'de',
} as const;

const response = {
  analysisId: 'id-1',
  deleteToken: 'del-1',
  uploadTicket: { url: 'https://s3.example/', fields: { key: 'k' } },
};

function setup(overrides: Partial<UploadDeps> = {}, onError = vi.fn()) {
  const calls: string[] = [];
  const deps: UploadDeps = {
    requestUpload: vi.fn(() => {
      calls.push('request');
      return Promise.resolve(response);
    }),
    saveAnalysis: vi.fn(() => void calls.push('save')),
    uploadToS3: vi.fn<UploadDeps['uploadToS3']>((_ticket, _file, onProgress) => {
      calls.push('upload');
      onProgress(0.5);
      return Promise.resolve();
    }),
    now: () => new Date('2026-11-03T10:00:00.000Z'),
    ...overrides,
  };
  const hook = renderHook(() => useUpload({ deps, onError }));
  return { ...hook, deps, calls, onError };
}

describe('useUpload', () => {
  it('starts idle', () => {
    expect(setup().result.current.state).toEqual({ status: 'idle' });
  });

  it('requests, stores locally, uploads and ends in done, in that order', async () => {
    const { result, deps, calls, onError } = setup();

    await act(() => result.current.start(params));

    expect(calls).toEqual(['request', 'save', 'upload']);
    expect(deps.requestUpload).toHaveBeenCalledWith({
      captchaToken: 'token',
      contractType: 'rental',
      language: 'de',
    });
    expect(deps.saveAnalysis).toHaveBeenCalledWith({
      analysisId: 'id-1',
      deleteToken: 'del-1',
      fileName: 'mietvertrag.pdf',
      contractType: 'rental',
      createdAt: '2026-11-03T10:00:00.000Z',
    });
    expect(result.current.state).toEqual({ status: 'done', analysisId: 'id-1' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('exposes the states requesting and uploading with progress', async () => {
    let finishRequest: (value: typeof response) => void = () => undefined;
    let finishUpload: () => void = () => undefined;
    let reportProgress: (fraction: number) => void = () => undefined;
    const { result } = setup({
      requestUpload: () => new Promise((resolve) => (finishRequest = resolve)),
      uploadToS3: (_ticket, _file, onProgress) => {
        reportProgress = onProgress;
        return new Promise<void>((resolve) => (finishUpload = resolve));
      },
    });

    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.start(params);
    });
    expect(result.current.state).toEqual({ status: 'requesting' });

    await act(() => {
      finishRequest(response);
      return Promise.resolve();
    });
    expect(result.current.state).toEqual({ status: 'uploading', progress: 0 });

    act(() => {
      reportProgress(0.4);
    });
    expect(result.current.state).toEqual({ status: 'uploading', progress: 0.4 });

    await act(async () => {
      finishUpload();
      await running;
    });
    expect(result.current.state.status).toBe('done');
  });

  it.each([
    ['CAPTCHA_INVALID', 'captchaInvalid'],
    ['DAILY_LIMIT_REACHED', 'dailyLimit'],
    ['BUDGET_EXHAUSTED', 'budgetExhausted'],
    ['INTERNAL', 'internal'],
  ])('maps API error %s to %s, calls onError and does not upload', async (code, messageKey) => {
    const { result, deps, onError } = setup({
      requestUpload: () => Promise.reject(new ApiError(code)),
    });

    await act(() => result.current.start(params));

    expect(result.current.state).toEqual({ status: 'error', messageKey });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(deps.saveAnalysis).not.toHaveBeenCalled();
    expect(deps.uploadToS3).not.toHaveBeenCalled();
  });

  it('reports a network error', async () => {
    const { result, onError } = setup({
      requestUpload: () => Promise.reject(new NetworkError()),
    });
    await act(() => result.current.start(params));
    expect(result.current.state).toEqual({ status: 'error', messageKey: 'network' });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports an S3 rejection but keeps the already stored analysis', async () => {
    const { result, deps, onError } = setup({
      uploadToS3: () => Promise.reject(new S3UploadError(403)),
    });
    await act(() => result.current.start(params));
    expect(result.current.state).toEqual({ status: 'error', messageKey: 'uploadRejected' });
    expect(deps.saveAnalysis).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('can be started again after an error', async () => {
    const requestUpload = vi
      .fn<UploadDeps['requestUpload']>()
      .mockRejectedValueOnce(new ApiError('CAPTCHA_INVALID'))
      .mockResolvedValueOnce(response);
    const { result, onError } = setup({ requestUpload });

    await act(() => result.current.start(params));
    expect(result.current.state.status).toBe('error');
    await act(() => result.current.start(params));

    expect(result.current.state.status).toBe('done');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('ignores a second start while an upload is running', async () => {
    let finishRequest: (value: typeof response) => void = () => undefined;
    const requestUpload = vi.fn<UploadDeps['requestUpload']>(
      () => new Promise((resolve) => (finishRequest = resolve)),
    );
    const { result } = setup({ requestUpload });

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.start(params);
    });
    await act(() => result.current.start(params));
    expect(requestUpload).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRequest(response);
      await first;
    });
  });
});
