import prisma from '../src/lib/prisma';

async function backfill() {
  const repos = await prisma.repository.findMany({
    select: { id: true, lastCrawledAt: true }
  });

  let updatedCount = 0;
  for (const repo of repos) {
    if (repo.lastCrawledAt) {
      const result = await prisma.repositoryTechnology.updateMany({
        where: { repositoryId: repo.id },
        data: { lastDetectedAt: repo.lastCrawledAt }
      });
      updatedCount += result.count;
    }
  }
  console.log(`Backfilled ${updatedCount} repository-technology links.`);
}

backfill().catch(console.error);
