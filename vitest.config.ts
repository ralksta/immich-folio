import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Node stays the default: almost everything under test is plain logic and
    // does not need a DOM. A component test opts in per file with
    // `// @vitest-environment jsdom` in its first docblock (see
    // components/__tests__ for examples), which keeps the fast path fast.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'lib/__tests__/**/*.test.{ts,tsx}',
      'app/**/__tests__/**/*.test.{ts,tsx}',
      'components/__tests__/**/*.test.{ts,tsx}',
      'scripts/__tests__/**/*.test.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
