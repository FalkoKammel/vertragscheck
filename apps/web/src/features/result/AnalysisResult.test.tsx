// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisFixture } from '../../mocks/analysisFixtures';
import { fakeAnalysisApi } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';
import { ANALYSES_STORAGE_KEY } from '../upload/storage';
import { ResultView } from './ResultView';

const ID = '0b9f1c1e-4d7a-4a52-9d57-0c6a1f7e2b11';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(`id=${ID}`) }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const scrollIntoView = vi.fn();

function done(unverifiedQuotes?: number) {
  const analysis = analysisFixture('done', ID);
  if (unverifiedQuotes !== undefined && analysis.result) {
    analysis.result.unverifiedQuotes = unverifiedQuotes;
  }
  return analysis;
}

async function renderDone(unverifiedQuotes?: number) {
  fakeAnalysisApi([done(unverifiedQuotes)]);
  renderWithProviders(<ResultView />);
  await screen.findByRole('complementary');
}

const card = (name: RegExp) => screen.getByRole('button', { name });
const marks = () => [...document.querySelectorAll('mark')];
const markWith = (text: string) => {
  const mark = marks().find((m) => m.textContent.includes(text));
  if (!mark) throw new Error(`no mark with ${text}`);
  return mark;
};

describe('result page for a done analysis', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = scrollIntoView;
    scrollIntoView.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the counts per level', async () => {
    await renderDone();
    expect(screen.getByText('2 kritisch')).toBeDefined();
    expect(screen.getByText('1 prüfen')).toBeDefined();
    expect(screen.getByText('1 unauffällig')).toBeDefined();
    expect(screen.getByText(/3 Seiten/)).toBeDefined();
  });

  it('uses the saved file name, else the contract type', async () => {
    localStorage.setItem(
      ANALYSES_STORAGE_KEY,
      JSON.stringify([
        {
          analysisId: ID,
          deleteToken: 't',
          fileName: 'mietvertrag.pdf',
          contractType: 'rental',
          createdAt: '2026-11-03T10:15:00.000Z',
        },
      ]),
    );
    await renderDone();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('mietvertrag.pdf');
  });

  it('falls back to the contract type as title', async () => {
    await renderDone();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mietvertrag (Wohnraum)');
  });

  it('lists notable clauses by severity, then position', async () => {
    await renderDone();
    const aside = screen.getByRole('complementary');
    const titles = within(aside)
      .getAllByRole('button', { pressed: undefined })
      .filter((b) => b.id.startsWith('clause-card-'))
      .map((b) => b.textContent);
    expect(titles).toHaveLength(3);
    expect(titles[0]).toContain('Kaution');
    expect(titles[1]).toContain('Schönheitsreparaturen');
    expect(titles[2]).toContain('Tierhaltung');
  });

  it('keeps fine clauses collapsed until opened', async () => {
    await renderDone();
    const toggle = screen.getByRole('button', { name: '1 unauffällige Klausel geprüft' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /§ 3 ·/ })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(card(/§ 3 ·/)).toBeDefined();
  });

  it('shows a divider where a new page starts', async () => {
    await renderDone();
    const dividers = [...document.querySelectorAll('article div')]
      .filter((el) => /^Seite \d+$/.test(el.textContent))
      .map((el) => el.textContent);
    expect(dividers).toEqual(['Seite 2', 'Seite 3']);
  });

  it('mentions unverified quotes only when there are some', async () => {
    await renderDone();
    expect(screen.getByRole('note').textContent).toContain(
      '1 Zitat wurde im Text nicht gefunden und wird ausgeblendet.',
    );
  });

  it('hides the unverified note when all quotes were found', async () => {
    await renderDone(0);
    expect(screen.getByRole('note').textContent).not.toContain('nicht gefunden');
    expect(screen.getByRole('note').textContent).toContain('Alle Zitate wurden gegen');
  });

  it('selects the first critical clause initially', async () => {
    await renderDone();
    expect(card(/Kaution/).getAttribute('aria-pressed')).toBe('true');
    expect(markWith('vier Nettokaltmieten').getAttribute('data-selected')).toBe('true');
    expect(markWith('Zustimmung').getAttribute('data-selected')).toBeNull();
  });

  it('selects a clause and scrolls to its mark when its card is clicked', async () => {
    await renderDone();
    fireEvent.click(card(/Tierhaltung/));

    expect(card(/Tierhaltung/).getAttribute('aria-pressed')).toBe('true');
    expect(card(/Kaution/).getAttribute('aria-pressed')).toBe('false');
    expect(markWith('Zustimmung').getAttribute('data-selected')).toBe('true');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(markWith('Zustimmung'));
  });

  it('selects the card and scrolls to it when a mark is clicked', async () => {
    await renderDone();
    fireEvent.click(markWith('Zustimmung'));

    expect(card(/Tierhaltung/).getAttribute('aria-pressed')).toBe('true');
    expect(scrollIntoView.mock.contexts[0]).toBe(card(/Tierhaltung/));
  });

  it('opens the fine section when a fine mark is clicked', async () => {
    await renderDone();
    fireEvent.click(markWith('850,00 Euro'));

    expect(card(/§ 3 ·/).getAttribute('aria-pressed')).toBe('true');
    expect(scrollIntoView.mock.contexts[0]).toBe(card(/§ 3 ·/));
  });

  it('highlights card and marks on hover without scrolling', async () => {
    await renderDone();
    fireEvent.mouseEnter(card(/Tierhaltung/));
    expect(card(/Tierhaltung/).className).toContain('cardHovered');
    expect(markWith('Zustimmung').className).toContain('hovered');
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.mouseLeave(card(/Tierhaltung/));
    expect(markWith('Zustimmung').className).not.toContain('hovered');
  });

  it('renders the whole contract text', async () => {
    await renderDone();
    const text = document.querySelector('article')?.textContent ?? '';
    expect(text).toContain('§ 7 Schlussbestimmungen');
  });

  it('shows model, cost, duration and deletion date', async () => {
    await renderDone();
    expect(screen.getByText('Claude Haiku 4.5 (EU)')).toBeDefined();
    expect(screen.getByText('v3')).toBeDefined();
    expect(screen.getByText('≈ 1,4 ct')).toBeDefined();
    expect(screen.getByText('6,2 s')).toBeDefined();
    expect(screen.getByText('Wird am 3. Dezember 2026 gelöscht')).toBeDefined();
  });
});
