// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisFixture } from '../../mocks/analysisFixtures';
import { fakeAnalysisApi } from '../../test/fakeApi';
import { activeStep, renderWithProviders } from '../../test/render';
import { UploadForm } from './UploadForm';

const replace = vi.fn();
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('../../lib/api/s3-upload', () => ({ uploadToS3: () => Promise.resolve() }));
vi.mock('../../lib/api/uploads', () => ({
  requestUpload: () =>
    Promise.resolve({
      analysisId: 'a1',
      deleteToken: 'del',
      uploadTicket: { url: 'https://s3.example/', fields: {} },
    }),
}));
vi.mock('./TurnstileField', () => ({
  TurnstileField: ({ onToken }: { onToken: (token: string | null) => void }) => (
    <button
      type="button"
      onClick={() => {
        onToken('captcha-token');
      }}
    >
      solve captcha
    </button>
  ),
}));

function isDisabled(button: HTMLElement) {
  return (button as HTMLButtonElement).disabled;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function fillAndSubmit() {
  const file = new File(['%PDF-1.7'], 'mietvertrag.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Vertrag als PDF'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('solve captcha'));
  const submit = screen.getByRole('button', { name: 'Analyse starten' });
  await waitFor(() => {
    expect(isDisabled(submit)).toBe(false);
  });
  fireEvent.click(submit);
}

describe('UploadForm after the upload', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replace.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows extracting, then analysing, then redirects when done', async () => {
    fakeAnalysisApi([
      analysisFixture('running', 'a1'),
      analysisFixture('analysing', 'a1'),
      analysisFixture('done', 'a1'),
    ]);
    renderWithProviders(<UploadForm />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(activeStep()).toBe('Text wird extrahiert');
    });
    expect(replace).not.toHaveBeenCalled();

    await advance(2000);
    await waitFor(() => {
      expect(activeStep()).toBe('Klauseln werden analysiert');
    });
    expect(replace).not.toHaveBeenCalled();

    await advance(2000);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith({ pathname: '/result', query: { id: 'a1' } });
    });
  });

  it('shows the failure and brings the form back with the file kept and the captcha cleared', async () => {
    fakeAnalysisApi([analysisFixture('failed', 'a1')]);
    renderWithProviders(<UploadForm />);
    await fillAndSubmit();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'In dieser PDF wurde kein Text gefunden',
    );
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Andere Datei versuchen' }));

    expect(screen.getByText(/mietvertrag\.pdf/)).toBeDefined();
    const submit = screen.getByRole('button', { name: 'Analyse starten' });
    expect(isDisabled(submit)).toBe(true);
    fireEvent.click(screen.getByText('solve captcha'));
    await waitFor(() => {
      expect(isDisabled(submit)).toBe(false);
    });
  });

  it('shows not found for a 404 without retrying', async () => {
    const api = fakeAnalysisApi(['notfound']);
    renderWithProviders(<UploadForm />);
    await fillAndSubmit();

    expect(await screen.findByText('Analyse nicht gefunden')).toBeDefined();
    expect(api).toHaveBeenCalledTimes(1);
  });
});
