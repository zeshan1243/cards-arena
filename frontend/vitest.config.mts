import { defineConfig } from 'vitest/config';

// Pure-TypeScript game engine tests (no Angular). Karma runs *.spec.ts; Vitest runs *.test.ts.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
