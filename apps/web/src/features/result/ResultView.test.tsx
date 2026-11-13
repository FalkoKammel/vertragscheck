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

  it('keeps showing the static layout for sample analyses without a request', () => {
    const api = fakeAnalysisApi([]);
    search = 'id=sample-rental';
    renderWithProviders(<ResultView />);
    expect(screen.getByText('Auffällige Klauseln')).toBeDefined();
    expect(api).not.toHaveBeenCalled();
  });
});
