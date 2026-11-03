import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  agentRules: false,
  turbopack: {
    resolveAlias: {
      // msw's exports mark `msw/browser` as "node: null", which fails the server-side pass of
      // the dev build, even though the import only runs in the browser (see MockProvider).
      'msw/browser': './node_modules/msw/lib/browser/index.js',
    },
  },
};

export default withNextIntl(nextConfig);
