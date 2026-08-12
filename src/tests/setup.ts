import { vi } from 'vitest';

// Force tests to use the test database
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Reset the global prisma instance to ensure it picks up the updated DATABASE_URL
global.prisma = undefined;
