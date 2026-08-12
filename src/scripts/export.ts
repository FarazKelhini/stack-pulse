import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export async function main() {
  logger.info({ service: 'export', operation: 'start', status: 'running' });
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';
  const generatedAt = new Date().toISOString();
  const outputDir = path.join(process.cwd(), 'public', 'datasets');

  try {
    await fs.mkdir(outputDir, { recursive: true });

    // 1. Export technologies.json
    const technologies = await prisma.technology.findMany({
      where: { isActive: true },
      select: { slug: true, name: true, npmPackage: true, category: true, description: true, repoCount: true },
    });
    const techData = { version: '1.0', generatedAt, commitSha, technologies };
    const techPath = path.join(outputDir, 'technologies.json');
    await fs.writeFile(techPath, JSON.stringify(techData, null, 2));
    logger.info({ service: 'export', operation: 'technologies', size: (await fs.stat(techPath)).size });

    // 2. Export repositories.json
    const repositories = await prisma.repository.findMany({
      where: { technologies: { some: {} } },
      orderBy: { stars: 'desc' },
      take: 10000,
      select: { fullName: true, url: true, stars: true, technologies: { select: { technology: { select: { slug: true } } } } },
    });
    const repoData = {
      version: '1.0',
      generatedAt,
      commitSha,
      repositories: repositories.map(r => ({
        fullName: r.fullName,
        url: r.url,
        stars: r.stars,
        technologies: r.technologies.map(t => t.technology.slug),
      })),
    };
    const repoPath = path.join(outputDir, 'repositories.json');
    await fs.writeFile(repoPath, JSON.stringify(repoData, null, 2));
    logger.info({ service: 'export', operation: 'repositories', size: (await fs.stat(repoPath)).size });

    // 3. Export pairings.json
    const pairings = await prisma.technologyPairing.findMany({
      where: {
        technologyA: { isActive: true },
        technologyB: { isActive: true },
      },
      select: { technologyA: { select: { slug: true } }, technologyB: { select: { slug: true } }, repositoryCount: true, strengthScore: true },
    });
    const pairingData = {
      version: '1.0',
      generatedAt,
      commitSha,
      pairings: pairings.map(p => ({
        technologyA: p.technologyA.slug,
        technologyB: p.technologyB.slug,
        repositoryCount: p.repositoryCount,
        strengthScore: p.strengthScore,
      })),
    };
    const pairingPath = path.join(outputDir, 'pairings.json');
    await fs.writeFile(pairingPath, JSON.stringify(pairingData, null, 2));
    logger.info({ service: 'export', operation: 'pairings', size: (await fs.stat(pairingPath)).size });

    // 4. Export trending.json
    const latestSnapshot = await prisma.trendingSnapshot.findFirst({
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    });

    if (latestSnapshot) {
      const today = latestSnapshot.snapshotDate;
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      const trending = await prisma.trendingSnapshot.findMany({
        where: { snapshotDate: today },
        select: {
          technology: { select: { slug: true, name: true, category: true, repoCount: true } },
          trendScore: true,
          adoptionCount: true,
          adoptionDelta: true,
        },
      });

      const trendingData = {
        version: '1.0',
        generatedAt,
        commitSha,
        trending: trending.map(t => ({
          slug: t.technology.slug,
          name: t.technology.name,
          trendScore: t.trendScore,
          adoptionDelta: t.adoptionDelta,
          snapshotDate: today.toISOString().split('T')[0],
        })),
      };
      const trendingPath = path.join(outputDir, 'trending.json');
      await fs.writeFile(trendingPath, JSON.stringify(trendingData, null, 2));
      logger.info({ service: 'export', operation: 'trending', size: (await fs.stat(trendingPath)).size });
    }

    // 5. Export weekly-trending.json
    const distinctSnapshots = await prisma.trendingSnapshot.findMany({
      distinct: ['snapshotDate'],
      orderBy: { snapshotDate: 'desc' },
      take: 2,
      select: { snapshotDate: true },
    });

    if (distinctSnapshots.length > 0 && distinctSnapshots[0]) {
      const compareDate = distinctSnapshots[0].snapshotDate;
      const sevenDaysAgo = new Date(compareDate);
      sevenDaysAgo.setDate(compareDate.getDate() - 7);

      const weeklyTechs = await prisma.trendingSnapshot.findMany({
        where: { snapshotDate: compareDate },
        select: {
          technologyId: true,
          technology: { select: { slug: true, name: true, category: true, repoCount: true } },
          adoptionCount: true,
        },
      });

      const weeklyTrending = [];
      for (const tech of weeklyTechs) {
        const priorSnap = await prisma.trendingSnapshot.findFirst({
          where: {
            technologyId: tech.technologyId,
            snapshotDate: { lte: sevenDaysAgo },
          },
          orderBy: { snapshotDate: 'desc' },
          select: { adoptionCount: true },
        });

        const weeklyDelta = tech.adoptionCount - (priorSnap?.adoptionCount ?? 0);
        if (weeklyDelta <= 0) continue;

        const priorAdoption = priorSnap?.adoptionCount ?? 0;
        const weeklyPercentChange = priorAdoption > 0
          ? Number(((weeklyDelta / priorAdoption) * 100).toFixed(1))
          : null;

        weeklyTrending.push({
          slug: tech.technology.slug,
          name: tech.technology.name,
          category: tech.technology.category,
          repoCount: tech.technology.repoCount,
          weeklyDelta,
          weeklyPercentChange,
        });
      }

      weeklyTrending.sort((a, b) => b.weeklyDelta - a.weeklyDelta);

      const weeklyData = {
        version: '1.0',
        generatedAt,
        commitSha,
        technologies: weeklyTrending,
        snapshotDate: compareDate.toISOString().split('T')[0],
        comparisonDate: sevenDaysAgo.toISOString().split('T')[0],
      };
      const weeklyPath = path.join(outputDir, 'weekly-trending.json');
      await fs.writeFile(weeklyPath, JSON.stringify(weeklyData, null, 2));
      logger.info({ service: 'export', operation: 'weekly-trending', size: (await fs.stat(weeklyPath)).size });
    }

    logger.info({ service: 'export', operation: 'complete', status: 'success' });
  } catch (err: any) {
    logger.error({ service: 'export', operation: 'complete', status: 'error', error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err: any) => {
    logger.error({ service: 'export', operation: 'complete', status: 'critical_error', error: err.message }, 'Unhandled error in dataset export');
    process.exit(1);
  });
}
