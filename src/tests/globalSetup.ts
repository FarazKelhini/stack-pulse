import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

export async function setup() {
  console.log('Running migrations against TEST_DATABASE_URL...');

  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL is not defined in environment variables');
  }

  try {
    // Run prisma migrate deploy using the test database URL
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
      stdio: 'inherit',
    });
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}
