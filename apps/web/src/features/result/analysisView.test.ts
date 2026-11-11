import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '../../lib/api/errors';
import { analysisFixture } from '../../mocks/analysisFixtures';
import { analysisErrorKey, isAnalysisId, toPhase } from './analysisView';

describe('toPhase', () => {
  it('is extracting without data, while pending_upload and while extracting', () => {
    expect(toPhase(undefined)).toBe('extracting');
    expect(toPhase(analysisFixture('pending_upload', 'a'))).toBe('extracting');
    expect(toPhase(analysisFixture('running', 'a'))).toBe('extracting');
  });

  it('is analysing once the backend stage is analysing', () => {
    expect(toPhase(analysisFixture('analysing', 'a'))).toBe('analysing');
  });
});

describe('analysisErrorKey', () => {
  it('maps request errors', () => {
    expect(analysisErrorKey(undefined, new ApiError('ANALYSIS_NOT_FOUND', 404))).toBe('notFound');
    expect(analysisErrorKey(undefined, new NetworkError())).toBe('network');
    expect(analysisErrorKey(undefined, new ApiError('INTERNAL', 500))).toBe('internal');
  });

  it('maps the failure reason of a failed analysis', () => {
    expect(analysisErrorKey(analysisFixture('failed', 'a'), null)).toBe('noTextLayer');
    expect(
      analysisErrorKey({ ...analysisFixture('failed', 'a'), failureReason: 'TIMEOUT' }, null),
    ).toBe('timeout');
  });

  it('is null while the analysis is fine or not loaded yet', () => {
    expect(analysisErrorKey(undefined, null)).toBeNull();
    expect(analysisErrorKey(analysisFixture('running', 'a'), null)).toBeNull();
    expect(analysisErrorKey(analysisFixture('done', 'a'), null)).toBeNull();
  });
});

describe('isAnalysisId', () => {
  it('accepts UUIDs only', () => {
    expect(isAnalysisId('0b9f1c1e-4d7a-4a52-9d57-0c6a1f7e2b11')).toBe(true);
    expect(isAnalysisId('xyz')).toBe(false);
    expect(isAnalysisId('')).toBe(false);
  });
});
