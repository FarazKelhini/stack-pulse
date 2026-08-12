import { defineConfig } from 'vitest/config';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './src/tests/globalSetup.ts',
    setupFiles: ['./src/tests/setup.ts'],
    pool: 'forks',
    // Integration tests share TEST_DATABASE_URL, so their database resets must
    // not race with another test file's setup or assertions.
    fileParallelism: false,
  },
});
