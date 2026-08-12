import prisma from '../src/lib/prisma';
import { GitHubClient } from '../src/lib/github';
import { logger } from '../src/lib/logger';
import { processRepository, recomputeRepoCounts } from '../src/scripts/crawl';
import { matchTechnologies } from '../src/lib/matcher';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export async function refreshRepository(github: GitHubClient, repo: any): Promise<void> {
  const node = await github.getRepository(repo.fullName);

  if (!node) {
    const affectedTechIds = repo.technologies.map((t: any) => t.technologyId);
    await prisma.$transaction([
      prisma.repositoryTechnology.deleteMany({ where: { repositoryId: repo.id } }),
      prisma.repository.delete({ where: { id: repo.id } }),
    ]);
    if (affectedTechIds.length > 0) await recomputeRepoCounts(affectedTechIds);
    logger.info({ repo: repo.fullName }, 'Repository deleted (not found/inaccessible)');
    console.log(`[DEL] Repository: ${repo.fullName} (deleted)`);
    return;
  }

  let matchedSlugs: string[] = [];
  if (node.object && node.object.text) {
    try {
      const pkg = JSON.parse(node.object.text);
      matchedSlugs = matchTechnologies(pkg);
    } catch (e) {
      logger.warn({ repo: repo.fullName }, 'Failed to parse package.json during refresh, skipping');
      console.log(`[WARN] Repository: ${repo.fullName} (failed to parse package.json)`);
      return;
    }
  }

  const techs = await prisma.technology.findMany({
    where: { slug: { in: matchedSlugs } },
    select: { id: true, slug: true },
  });
  const techIdBySlug = new Map(techs.map((t) => [t.slug, t.id]));
  const techIds = matchedSlugs.map(slug => techIdBySlug.get(slug)).filter((id): id is string => !!id);

  const existingTechIds = new Set<string>(repo.technologies.map((r: any) => r.technologyId));

  const { affectedTechIds } = await prisma.$transaction(async (tx) => {
    return await processRepository(tx, node as any, techIds, existingTechIds);
  });

  if (affectedTechIds.length > 0) {
    await recomputeRepoCounts(affectedTechIds);
  }

  logger.info({ repo: repo.fullName }, 'Repository refreshed');
  console.log(`[OK] Repository: ${repo.fullName} (refreshed)`);
}

async function runRefresh() {
  if (!GITHUB_TOKEN) {
    logger.error('GITHUB_TOKEN is not set');
    process.exit(1);
  }

  const github = new GitHubClient(GITHUB_TOKEN);

  const totalRepos = await prisma.repository.count();
  const take = Math.ceil(totalRepos / 30);

  // Fetch the oldest repositories based on technology link age, or last crawl date
  const repos = await prisma.$queryRaw<any[]>`
    SELECT r.* FROM "Repository" r
    LEFT JOIN "RepositoryTechnology" rt ON r.id = rt."repositoryId"
    GROUP BY r.id
    ORDER BY COALESCE(MIN(rt."lastDetectedAt"), r."lastCrawledAt") ASC
    LIMIT ${take}
  `;

  // Fetch full details for the selected batch
  const repoDetails = await prisma.repository.findMany({
    where: { id: { in: repos.map(r => r.id) } },
    include: { technologies: { include: { technology: true } } }
  });

  logger.info({ count: repoDetails.length }, 'Starting refresh job');

  for (const repo of repoDetails) {
    try {
      await refreshRepository(github, repo);
    } catch (err) {
      logger.error({ err, repo: repo.fullName }, 'Failed to refresh repository, skipping');
    }
  }
}

import { fileURLToPath } from 'url';

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runRefresh().catch((err) => {
    logger.error({ err }, 'Systemic error in refresh job, halting pipeline');
    process.exit(1);
  });
}
