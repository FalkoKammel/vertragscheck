// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisFixture } from '../../mocks/analysisFixtures';
import { fakeAnalysisApi } from '../../test/fakeApi';
import { makeQueryClient, Wrapper } from '../../test/render';
import { useAnalysis } from './useAnalysis';

function setup(id: string | null) {
  const client = makeQueryClient();
  return renderHook(() => useAnalysis(id), {
    wrapper: ({ children }) => <Wrapper client={client}>{children}</Wrapper>,
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useAnalysis', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('polls while running and stops at done', async () => {
    const api = fakeAnalysisApi([
      analysisFixture('running', 'a'),
      analysisFixture('analysing', 'a'),
      analysisFixture('done', 'a'),
    ]);
    const { result } = setup('a');

    await waitFor(() => {
      expect(result.current.data?.status).toBe('running');
    });
    await advance(2000);
    await waitFor(() => {
      expect(result.current.data?.stage).toBe('analysing');
    });
    await advance(2000);
    await waitFor(() => {
      expect(result.current.data?.status).toBe('done');
    });

    const calls = api.mock.calls.length;
    await advance(10_000);
    expect(api).toHaveBeenCalledTimes(calls);
    expect(calls).toBe(3);
  });

  it('stops polling at failed', async () => {
    const api = fakeAnalysisApi([analysisFixture('failed', 'a')]);
    const { result } = setup('a');
    await waitFor(() => {
      expect(result.current.data?.status).toBe('failed');
    });
    await advance(10_000);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('sends no request without an ID', async () => {
    const api = fakeAnalysisApi([analysisFixture('running', 'a')]);
    setup(null);
    await advance(5000);
    expect(api).not.toHaveBeenCalled();
  });

  it('does not retry a 404', async () => {
    const api = fakeAnalysisApi(['notfound']);
    const { result } = setup('a');
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    await advance(10_000);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('retries other errors up to three times', async () => {
    const api = fakeAnalysisApi(['network']);
    const { result } = setup('a');
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(api).toHaveBeenCalledTimes(4);
  });
});
