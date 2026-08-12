import prisma from '../src/lib/prisma';

async function main() {
  const count = await prisma.trendingSnapshot.count();
  console.log('Total TrendingSnapshots:', count);

  const latest = await prisma.trendingSnapshot.findFirst({
    orderBy: { snapshotDate: 'desc' },
  });
  console.log('Latest Snapshot:', latest);

  const activeTechs = await prisma.technology.count({
    where: { isActive: true }
  });
  console.log('Active Technologies:', activeTechs);
}

main().catch(console.error);
