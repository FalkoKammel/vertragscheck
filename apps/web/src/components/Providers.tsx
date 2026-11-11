'use client';

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { cssVariablesResolver, theme } from '@/theme';
import { MockProvider } from './MockProvider';

const showDevtools = process.env.NODE_ENV === 'development';
const ReactQueryDevtools = showDevtools
  ? dynamic(() =>
      import('@tanstack/react-query-devtools').then((module) => module.ReactQueryDevtools),
    )
  : null;

export function Providers({ children }: { children: ReactNode }) {
  // Created once per browser session, so the cache survives navigation between pages.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }),
  );

  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="light"
      forceColorScheme="light"
    >
      <QueryClientProvider client={queryClient}>
        <MockProvider>{children}</MockProvider>
        {ReactQueryDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </MantineProvider>
  );
}
