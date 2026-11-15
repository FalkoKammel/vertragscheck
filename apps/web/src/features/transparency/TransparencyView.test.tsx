// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StatsResponse } from '@/lib/api/getStats';
import { renderWithProviders } from '../../test/render';
import { TransparencyView } from './TransparencyView';

const stats: StatsResponse = {
  month: '2026-11',
  analyses: { done: 4, failed: 1 },
  meanCostMicroUsd: 48_000,
  p95LatencyMs: 26_300,
  unverifiedQuotes: { num: 1, den: 50 },
  budget: { spentMicroUsd: 2_400_000, limitMicroUsd: 10_000_000 },
  activeModelId: 'eu.anthropic.claude-sonnet-4-6',
};

function stubStats(reply: StatsResponse | 'error') {
  const mock = vi.fn(() =>
    Promise.resolve(
      reply === 'error'
        ? Response.json({ code: 'INTERNAL' }, { status: 500 })
        : Response.json(reply),
    ),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

function tile(label: string): HTMLElement {
  const section = screen.getByRole('region', { name: 'Kennzahlen diesen Monat' });
  const parent = within(section).getByText(label).parentElement;
  if (!parent) throw new Error(`no tile for ${label}`);
  return parent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TransparencyView', () => {
  it('shows the four figures with the number of analyses they are based on', async () => {
    stubStats(stats);
    renderWithProviders(<TransparencyView />);

    expect(await screen.findAllByText('n = 4')).toHaveLength(3);
    expect(within(tile('Analysen diesen Monat')).getByText('4')).toBeTruthy();
    expect(within(tile('Analysen diesen Monat')).getByText('1 fehlgeschlagen')).toBeTruthy();
    expect(within(tile('Ø Kosten pro Analyse')).getByText('4,8 ct')).toBeTruthy();
    expect(within(tile('Dauer (95. Perzentil)')).getByText('26,3 s')).toBeTruthy();
    expect(within(tile('Verworfene Zitate')).getByText(/2\s?%/)).toBeTruthy();
  });

  it('shows the budget in USD and a progress bar', async () => {
    stubStats(stats);
    renderWithProviders(<TransparencyView />);
    expect(await screen.findByText(/2,40\s\$ von 10,00\s\$/)).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Verbrauchtes Monatsbudget' });
    expect(bar.getAttribute('aria-valuenow')).toBe('24');
  });

  it('marks the production model as active and lists only models with an entry', async () => {
    stubStats(stats);
    renderWithProviders(<TransparencyView />);
    await screen.findByText('aktiv');
    const sonnet = screen.getByText('Claude Sonnet 4.6 (EU)').closest('tr') as HTMLElement;
    expect(within(sonnet).getByText('aktiv')).toBeTruthy();
    expect(within(sonnet).getByText('34/37')).toBeTruthy();
    const haiku = screen.getByText('Claude Haiku 4.5 (EU)').closest('tr') as HTMLElement;
    expect(within(haiku).queryByText('aktiv')).toBeNull();
    expect(screen.queryByText(/Haiku 5\.5/)).toBeNull();
    expect(screen.getByText(/8 Musterverträge/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /docs\/eval\.md/ }).getAttribute('href')).toContain(
      '/docs/eval.md',
    );
  });

  it('shows dashes and an explanation for a month without analyses', async () => {
    stubStats({
      ...stats,
      analyses: { done: 0, failed: 0 },
      meanCostMicroUsd: null,
      p95LatencyMs: null,
      unverifiedQuotes: { num: 0, den: 0 },
      budget: { spentMicroUsd: 0, limitMicroUsd: 10_000_000 },
    });
    renderWithProviders(<TransparencyView />);
    expect(await screen.findByText(/Noch keine Analysen in diesem Monat/)).toBeTruthy();
    expect(within(tile('Ø Kosten pro Analyse')).getByText('–')).toBeTruthy();
    expect(within(tile('Dauer (95. Perzentil)')).getByText('–')).toBeTruthy();
    expect(within(tile('Verworfene Zitate')).getByText('–')).toBeTruthy();
    expect(screen.queryByText(/n = /)).toBeNull();
  });

  it('omits n = … once there are enough analyses', async () => {
    stubStats({ ...stats, analyses: { done: 184, failed: 0 } });
    renderWithProviders(<TransparencyView />);
    expect(await screen.findByText('184')).toBeTruthy();
    expect(screen.queryByText(/n = /)).toBeNull();
  });

  it('shows dashes and a notice when the API fails, but still the model table', async () => {
    stubStats('error');
    renderWithProviders(<TransparencyView />);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(within(tile('Analysen diesen Monat')).getByText('–')).toBeTruthy();
    expect(screen.getByText('Claude Sonnet 4.6 (EU)')).toBeTruthy();
    expect(screen.queryByText('aktiv')).toBeNull();
  });
});
