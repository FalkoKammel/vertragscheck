import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/web', 'services/api', 'infra'],
    passWithNoTests: true,
  },
});
