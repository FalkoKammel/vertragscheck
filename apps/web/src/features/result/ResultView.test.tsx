// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisFixture } from '../../mocks/analysisFixtures';
import { fakeAnalysisApi } from '../../test/fakeApi';
import { activeStep, renderWithProviders } from '../../test/render';
import { ResultView } from './ResultView';

const ID = '0b9f1c1e-4d7a-4a52-9d57-0c6a1f7e2b11';
let search = `id=${ID}`;
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('ResultView', () => {
  beforeEach(() => {
    search = `id=${ID}`;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the progress card while the analysis is running', async () => {
    fakeAnalysisApi([analysisFixture('analysing', ID)]);
    renderWithProviders(<ResultView />);

    await waitFor(() => {
      expect(activeStep()).toBe('Klauseln werden analysiert');
    });
  });

  it('shows not found with a link to /upload on 404', async () => {
    fakeAnalysisApi(['notfound']);
    renderWithProviders(<ResultView />);

    expect(await screen.findByText('Analyse nicht gefunden')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Neue Analyse starten' }).getAttribute('href')).toBe(
      '/upload',
    );
  });

  it('shows not found for a malformed ID without a request', () => {
    const api = fakeAnalysisApi([analysisFixture('running', 'xyz')]);
    search = 'id=xyz';
    renderWithProviders(<ResultView />);

    expect(screen.getByText('Analyse nicht gefunden')).toBeDefined();
    expect(api).not.toHaveBeenCalled();
  });

  it('shows the failure reason for a failed analysis', async () => {
    fakeAnalysisApi([analysisFixture('failed', ID)]);
    renderWithProviders(<ResultView />);
    expect((await screen.findByRole('alert')).textContent).toContain('kein Text gefunden');
  });

  describe('sample analyses', () => {
    function stubSample(sample = analysisFixture('done', 'sample-rental')) {
      const mock = vi.fn<(url: string) => Promise<Response>>(() =>
        Promise.resolve(Response.json(sample)),
      );
      vi.stubGlobal('fetch', mock);
      return mock;
    }

    it('loads the static file for the locale instead of calling the API', async () => {
      const fetchMock = stubSample();
      search = 'id=sample-rental';
      renderWithProviders(<ResultView />);

      expect(await screen.findByText('Beispielanalyse')).toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/samples/sample-rental.de.json');
    });

    it('names the prompt version and hides deletion and expiry', async () => {
      const sample = analysisFixture('done', 'sample-employment');
      localStorage.setItem(
        'vertragscheck.analyses',
        JSON.stringify([
          {
            analysisId: 'sample-employment',
            deleteToken: 'token',
            fileName: 'x.pdf',
            contractType: 'employment',
            createdAt: new Date().toISOString(),
          },
        ]),
      );
      stubSample(sample);
      search = 'id=sample-employment';
      renderWithProviders(<ResultView />);

      const version = sample.result?.run.promptVersion ?? '';
      expect(
        await screen.findByText(`Unbearbeitete Ausgabe eines einzelnen Laufs, Prompt ${version}`),
      ).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Analyse löschen' })).toBeNull();
      expect(screen.queryByText(/gelöscht/)).toBeNull();
    });

    it('shows not found for an unknown sample without a request', () => {
      const fetchMock = stubSample();
      search = 'id=sample-unknown';
      renderWithProviders(<ResultView />);

      expect(screen.getByText('Analyse nicht gefunden')).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows not found when the sample file is missing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(new Response('<html></html>', { status: 200 }))),
      );
      search = 'id=sample-rental';
      renderWithProviders(<ResultView />);

      expect(await screen.findByText('Analyse nicht gefunden')).toBeDefined();
    });
  });
});
