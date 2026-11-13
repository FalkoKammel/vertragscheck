// @vitest-environment jsdom
import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAnalysis } from '../features/upload/storage';
import { renderWithProviders } from '../test/render';
import { Header } from './Header';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/',
}));
vi.mock('./LocaleSwitch', () => ({ LocaleSwitch: () => null }));

describe('Header', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hides "Meine Analysen" without stored analyses and shows it once one is saved', async () => {
    renderWithProviders(<Header />);
    expect(screen.queryByRole('link', { name: 'Meine Analysen' })).toBeNull();

    act(() => {
      saveAnalysis({
        analysisId: 'a1',
        deleteToken: 't',
        fileName: 'v.pdf',
        contractType: 'rental',
        createdAt: new Date().toISOString(),
      });
    });
    expect((await screen.findByRole('link', { name: 'Meine Analysen' })).getAttribute('href')).toBe(
      '/analyses',
    );
  });

  it('shows the link right away when entries already exist', async () => {
    localStorage.setItem(
      'vertragscheck.analyses',
      JSON.stringify([
        {
          analysisId: 'a1',
          deleteToken: 't',
          fileName: 'v.pdf',
          contractType: 'rental',
          createdAt: new Date().toISOString(),
        },
      ]),
    );
    renderWithProviders(<Header />);
    expect(await screen.findByRole('link', { name: 'Meine Analysen' })).toBeTruthy();
  });
});
