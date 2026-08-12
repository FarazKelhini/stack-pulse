import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function main() {
  logger.info({ service: 'aggregate', operation: 'pairing_aggregation', status: 'running' });
  const startTime = Date.now();

  try {
    // Execute a single set-based bulk upsert via raw SQL
    const updatedRows = await prisma.$executeRaw`
      INSERT INTO "TechnologyPairing" ("technologyAId", "technologyBId", "repositoryCount", "strengthScore", "updatedAt")
      SELECT
        LEAST(ra."technologyId", rb."technologyId") as tA,
        GREATEST(ra."technologyId", rb."technologyId") as tB,
        COUNT(ra."repositoryId") as repo_count,
        -- Jaccard Similarity Coefficient formula: |A ∩ B| / (|A| + |B| - |A ∩ B|)
        CAST(COUNT(ra."repositoryId") AS FLOAT) / (ta."repoCount" + tb."repoCount" - COUNT(ra."repositoryId")) as strength,
        NOW()
      FROM "RepositoryTechnology" ra
      JOIN "RepositoryTechnology" rb ON ra."repositoryId" = rb."repositoryId" AND ra."technologyId" < rb."technologyId"
      JOIN "Technology" ta ON ta.id = ra."technologyId"
      JOIN "Technology" tb ON tb.id = rb."technologyId"
      GROUP BY tA, tB, ta."repoCount", tb."repoCount"
      ON CONFLICT ("technologyAId", "technologyBId")
      DO UPDATE SET
        "repositoryCount" = EXCLUDED."repositoryCount",
        "strengthScore" = EXCLUDED."strengthScore",
        "updatedAt" = NOW();
    `;

    // Zero out any pairing not touched by this run — its repositories no longer co-occur.
    await prisma.$executeRaw`
      UPDATE "TechnologyPairing"
      SET "repositoryCount" = 0, "strengthScore" = 0, "updatedAt" = NOW()
      WHERE "updatedAt" < ${new Date(startTime)}
    `;

    const durationMs = Date.now() - startTime;
    logger.info({
      service: 'aggregate',
      operation: 'pairing_aggregation',
      durationMs,
      status: 'success',
      metrics: { pairsUpdated: updatedRows }
    });
  } catch (err: any) {
    logger.error({ service: 'aggregate', operation: 'pairing_aggregation', status: 'error', error: err.message });
    if (!process.env.VITEST) process.exit(0); // Graceful degradation as per Section 16
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    logger.error({ service: 'aggregate', operation: 'pairing_aggregation', status: 'critical_error', error: err.message });
    process.exit(1);
  });
}
