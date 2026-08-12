import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { Prisma } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function main() {
  logger.info({ service: 'snapshot', operation: 'snapshot_generation', status: 'running' });
  const startTime = Date.now();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    const techs = await prisma.technology.findMany({ select: { id: true, repoCount: true } });

    if (techs.length > 0) {
      const values = techs.map(
        (t) => `('${t.id}', '${today.toISOString().split('T')[0]}', ${t.repoCount}, 0)`
      ).join(',');

      await prisma.$executeRawUnsafe(`
        INSERT INTO "TrendingSnapshot" ("technologyId", "snapshotDate", "adoptionCount", "trendScore")
        VALUES ${values}
        ON CONFLICT ("technologyId", "snapshotDate")
        DO UPDATE SET "adoptionCount" = EXCLUDED."adoptionCount";
      `);
    }

    const durationMs = Date.now() - startTime;
    logger.info({
      service: 'snapshot',
      operation: 'snapshot_generation',
      durationMs,
      status: 'success',
      metrics: { snapshotsGenerated: techs.length }
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ service: 'snapshot', operation: 'snapshot_generation', status: 'error', error: errorMessage });
    if (!process.env.VITEST) process.exit(0); // Graceful degradation per SPEC
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    logger.error({ service: 'snapshot', operation: 'snapshot_generation', status: 'critical_error', error: err.message });
    process.exit(1);
  });
}
