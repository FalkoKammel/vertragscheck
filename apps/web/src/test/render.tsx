import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import messages from '../messages/de.json';
import { cssVariablesResolver, theme } from '../theme';

// Mantine reads these browser APIs, which jsdom does not have. Stubbed before every test because
// the tests call vi.unstubAllGlobals() to restore fetch.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    },
  );
});

// Vitest has no globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
}

export function Wrapper({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
      <NextIntlClientProvider locale="de" messages={messages} timeZone="Europe/Berlin">
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    </MantineProvider>
  );
}

export function renderWithProviders(ui: ReactElement) {
  const client = makeQueryClient();
  return render(ui, { wrapper: ({ children }) => <Wrapper client={client}>{children}</Wrapper> });
}

/** The label of the step the progress card currently marks as active. */
export function activeStep(): string | null {
  return document.querySelector('li[aria-current="step"]')?.textContent ?? null;
}
