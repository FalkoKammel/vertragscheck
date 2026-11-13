// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { LocaleSwitch } from './LocaleSwitch';

let search = '';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/result',
  Link: ({
    href,
    children,
    locale,
    ...rest
  }: {
    href: string;
    locale: string;
    children: React.ReactNode;
  }) => (
    <a href={`/${locale}${href}`} {...rest}>
      {children}
    </a>
  ),
}));

describe('LocaleSwitch', () => {
  beforeEach(() => {
    search = '';
  });

  it('links to the same path in the other language', () => {
    renderWithProviders(<LocaleSwitch />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/en/result');
  });

  it('keeps the query string, so the result page still has its id', () => {
    search = 'id=0b9f1c1e-4d7a-4a52-9d57-0c6a1f7e2b11';
    renderWithProviders(<LocaleSwitch />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/en/result?id=0b9f1c1e-4d7a-4a52-9d57-0c6a1f7e2b11',
    );
  });
});
