import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

async function main() {
  logger.info({ service: 'trends', operation: 'trend_computation', status: 'running' });
  const startTime = Date.now();

  try {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);

    // Single batched fetch: all snapshot history needed for every technology.
    const allSnapshots = await prisma.trendingSnapshot.findMany({
      where: { snapshotDate: { lte: today } },
      orderBy: { snapshotDate: 'asc' },
    });

    // Group in memory by technologyId.
    const byTech = new Map<string, typeof allSnapshots>();
    for (const s of allSnapshots) {
      const list = byTech.get(s.technologyId) ?? [];
      list.push(s);
      byTech.set(s.technologyId, list);
    }

    const updates: { technologyId: string; snapshotDate: Date; trendScore: number; adoptionDelta: number }[] = [];

    for (const [technologyId, history] of byTech) {
      const todaySnap = history.find(s => s.snapshotDate.getTime() === today.getTime());
      if (!todaySnap) continue;

      const priorRows = history.filter(s => s.snapshotDate.getTime() < today.getTime());
      if (priorRows.length < 3) continue;          // eligibility: ≥3 rows strictly before today
      if (todaySnap.adoptionCount < 10) continue;   // below threshold -> trendScore stays 0

      // previous = snapshot ~30 days prior, or oldest available if history < 30 days
      const atOrBefore30 = priorRows.filter(s => s.snapshotDate.getTime() <= thirtyDaysAgo.getTime());
      const prev = atOrBefore30.length > 0
        ? atOrBefore30[atOrBefore30.length - 1]   // closest to 30 days ago (rows sorted asc)
        : priorRows[0];                            // oldest available

      const previous = prev?.adoptionCount ?? 0;
      const score = (todaySnap.adoptionCount / Math.max(previous, 1))
                    * Math.log10(todaySnap.adoptionCount + 10);
      const delta = todaySnap.adoptionCount - previous;

      updates.push({ technologyId, snapshotDate: today, trendScore: score, adoptionDelta: delta });
    }

    if (updates.length > 0) {
      const values = updates.map(
        (u) => `('${u.technologyId}', '${u.snapshotDate.toISOString().split('T')[0]}', ${u.trendScore}, ${u.adoptionDelta})`
      ).join(',');

      await prisma.$executeRawUnsafe(`
        UPDATE "TrendingSnapshot" ts
        SET "trendScore" = v.score, "adoptionDelta" = v.delta
        FROM (VALUES ${values}) as v(techId, snapDate, score, delta)
        WHERE ts."technologyId" = v.techId AND ts."snapshotDate" = v.snapDate::date;
      `);
    }

    const durationMs = Date.now() - startTime;
    logger.info({
      service: 'trends',
      operation: 'trend_computation',
      durationMs,
      status: 'success',
      metrics: { updatesProcessed: updates.length }
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ service: 'trends', operation: 'trend_computation', status: 'error', error: errorMessage });
    process.exit(0); // Graceful degradation per SPEC
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  logger.error({ service: 'trends', operation: 'trend_computation', status: 'critical_error', error: errorMessage }, 'Unhandled error in trends computation');
  process.exit(1);
});
