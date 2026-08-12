import prisma from '../src/lib/prisma';

async function breakdown() {
  const now = new Date();
  const threshold7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get all repos not crawled in 7+ days
  const dormantRepos = await prisma.repository.findMany({
    where: { lastCrawledAt: { lt: threshold7 } },
    include: { technologies: { include: { technology: true } } }
  });

  console.log(`Total dormant repos: ${dormantRepos.length}`);

  // Simple grouping: we don't have a direct "slot" in the Repo model,
  // but we can group by the star ranges used in the crawler.
  const bins = {
    '11..100': 0,
    '101..1000': 0,
    '1001..10000': 0,
    '10001..100000': 0,
    '>100000': 0
  };

  for (const repo of dormantRepos) {
    if (repo.stars > 100000) bins['>100000']++;
    else if (repo.stars > 10000) bins['10001..100000']++;
    else if (repo.stars > 1000) bins['1001..10000']++;
    else if (repo.stars > 100) bins['101..1000']++;
    else bins['11..100']++;
  }

  console.table(bins);
}

breakdown().catch(console.error);
