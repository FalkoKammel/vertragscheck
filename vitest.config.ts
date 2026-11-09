import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/web', 'services/api', 'infra', 'eval'],
    passWithNoTests: true,
  },
});
