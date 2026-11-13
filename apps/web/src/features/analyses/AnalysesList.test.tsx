// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ANALYSES_STORAGE_KEY, readStoredAnalyses, type StoredAnalysis } from '../upload/storage';
import { AnalysesList } from './AnalysesList';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode }) => (
    <a href={JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const entry = (id: string, days: number): StoredAnalysis => ({
  analysisId: id,
  deleteToken: `token-${id}`,
  fileName: `${id}.pdf`,
  contractType: 'rental',
  createdAt: daysAgo(days),
});

function seed(entries: StoredAnalysis[]) {
  localStorage.setItem(ANALYSES_STORAGE_KEY, JSON.stringify(entries));
}

function stubDelete(status: number, body?: unknown) {
  const mock = vi.fn(() =>
    Promise.resolve(
      status === 204 ? new Response(null, { status }) : Response.json(body, { status }),
    ),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function confirmDeleteOf(fileName: string) {
  const row = (await screen.findByText(fileName)).closest('li');
  if (!row) throw new Error('no row');
  fireEvent.click(within(row).getByRole('button', { name: 'Analyse löschen' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Endgültig löschen' }));
  return dialog;
}

describe('AnalysesList', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the empty state with a link to the upload', async () => {
    renderWithProviders(<AnalysesList />);
    expect(await screen.findByText('In diesem Browser gibt es noch keine Analyse.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Vertrag prüfen' }).getAttribute('href')).toBe(
      JSON.stringify('/upload'),
    );
  });

  it('lists entries newest first with their deletion date and a link to the result', async () => {
    seed([entry('old', 10), entry('new', 1)]);
    renderWithProviders(<AnalysesList />);
    await screen.findByText('new.pdf');
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('new.pdf');
    expect(names[1]).toContain('old.pdf');
    expect(names[0]).toContain('Wird gelöscht am');
    expect(screen.getAllByRole('link', { name: 'Ergebnis öffnen' })[0]?.getAttribute('href')).toBe(
      JSON.stringify({ pathname: '/result', query: { id: 'new' } }),
    );
  });

  it('marks an entry older than 30 days as expired and removes it locally without an API call', async () => {
    seed([entry('gone', 31), entry('kept', 1)]);
    const fetchMock = stubDelete(204);
    renderWithProviders(<AnalysesList />);
    const row = (await screen.findByText('gone.pdf')).closest('li');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('Abgelaufen, serverseitig bereits gelöscht')).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Analyse löschen' })).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: 'Aus Liste entfernen' }));
    await waitFor(() => {
      expect(screen.queryByText('gone.pdf')).toBeNull();
    });
    expect(screen.getByText('kept.pdf')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes after confirmation: sends the token and removes the entry', async () => {
    seed([entry('a1', 1), entry('a2', 2)]);
    const fetchMock = stubDelete(204);
    renderWithProviders(<AnalysesList />);
    await confirmDeleteOf('a1.pdf');

    await waitFor(() => {
      expect(screen.queryByText('a1.pdf')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/analyses/a1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a1' },
    });
    expect(readStoredAnalyses().map((e) => e.analysisId)).toEqual(['a2']);
  });

  it('treats 404 as deleted', async () => {
    seed([entry('a1', 1)]);
    stubDelete(404, { code: 'ANALYSIS_NOT_FOUND' });
    renderWithProviders(<AnalysesList />);
    await confirmDeleteOf('a1.pdf');
    await waitFor(() => {
      expect(readStoredAnalyses()).toEqual([]);
    });
  });

  it('shows "Löschschlüssel ungültig" on 403 and keeps the entry', async () => {
    seed([entry('a1', 1)]);
    stubDelete(403, { code: 'INVALID_DELETE_TOKEN' });
    renderWithProviders(<AnalysesList />);
    const dialog = await confirmDeleteOf('a1.pdf');
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Löschschlüssel ungültig');
    expect(readStoredAnalyses()).toHaveLength(1);
  });

  it('shows a generic error for other failures', async () => {
    seed([entry('a1', 1)]);
    stubDelete(500, { code: 'INTERNAL' });
    renderWithProviders(<AnalysesList />);
    const dialog = await confirmDeleteOf('a1.pdf');
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Löschen fehlgeschlagen',
    );
    expect(readStoredAnalyses()).toHaveLength(1);
  });
});
