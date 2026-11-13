// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisFixture } from '../../mocks/analysisFixtures';
import { fakeAnalysisApi } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';
import { ANALYSES_STORAGE_KEY, saveAnalysis, type StoredAnalysis } from '../upload/storage';
import { ResultView } from './ResultView';

const ID = '0b9f1c1e-4d7a-4a52-9d57-0c6a1f7e2b11';
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(`id=${ID}`) }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const entry = (id: string): StoredAnalysis => ({
  analysisId: id,
  deleteToken: `token-${id}`,
  fileName: 'vertrag.pdf',
  contractType: 'rental',
  createdAt: new Date().toISOString(),
});

/** First call answers GET (the analysis), later DELETE calls get `deleteStatus`. */
function stubApi(deleteStatus: number) {
  const analysis = analysisFixture('done', ID);
  const mock = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'DELETE'
        ? deleteStatus === 204
          ? new Response(null, { status: 204 })
          : Response.json({ code: 'INVALID_DELETE_TOKEN' }, { status: deleteStatus })
        : Response.json(analysis),
    ),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function confirmDelete() {
  fireEvent.click(await screen.findByRole('button', { name: 'Analyse löschen' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Endgültig löschen' }));
  return dialog;
}

describe('result page deletion', () => {
  beforeEach(() => {
    localStorage.clear();
    replace.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers no delete button without a token in this browser', async () => {
    fakeAnalysisApi([analysisFixture('done', ID)]);
    renderWithProviders(<ResultView />);
    await screen.findByRole('complementary');
    expect(screen.queryByRole('button', { name: 'Analyse löschen' })).toBeNull();
  });

  it('shows the button and the hint when the token is stored', async () => {
    saveAnalysis(entry(ID));
    stubApi(204);
    renderWithProviders(<ResultView />);
    expect(await screen.findByRole('button', { name: 'Analyse löschen' })).toBeTruthy();
    expect(screen.getByText(/funktioniert nur in diesem Browser/)).toBeTruthy();
  });

  it('deletes, forgets the entry and goes to /analyses while other entries remain', async () => {
    saveAnalysis(entry('other'));
    saveAnalysis(entry(ID));
    const fetchMock = stubApi(204);
    renderWithProviders(<ResultView />);
    await confirmDelete();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/analyses');
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/analyses/${ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer token-${ID}` },
    });
    expect(localStorage.getItem(ANALYSES_STORAGE_KEY)).not.toContain(ID);
  });

  it('goes to the start page when it was the last entry', async () => {
    saveAnalysis(entry(ID));
    stubApi(204);
    renderWithProviders(<ResultView />);
    await confirmDelete();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });
  });

  it('shows the invalid-key error and stays on the page on 403', async () => {
    saveAnalysis(entry(ID));
    stubApi(403);
    renderWithProviders(<ResultView />);
    const dialog = await confirmDelete();
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Löschschlüssel ungültig');
    expect(replace).not.toHaveBeenCalled();
    expect(localStorage.getItem(ANALYSES_STORAGE_KEY)).toContain(ID);
  });
});
