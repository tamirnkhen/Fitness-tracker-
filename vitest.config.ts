import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/sql/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
