import prisma from '../src/lib/prisma';

async function preview() {
  const techs = await prisma.technology.findMany({select: {id: true, name: true}});
  const previewData = await Promise.all(techs.map(async (t) => {
    const totalCount = await prisma.repositoryTechnology.count({where: {technologyId: t.id}});
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeCount = await prisma.repositoryTechnology.count({
      where: {
        technologyId: t.id,
        repository: { lastCrawledAt: { gt: thirtyDaysAgo } }
      }
    });
    return { name: t.name, total: totalCount, active: activeCount };
  }));
  console.table(previewData.sort((a,b) => b.total - a.total).slice(0, 20));
}
preview().catch(console.error);
