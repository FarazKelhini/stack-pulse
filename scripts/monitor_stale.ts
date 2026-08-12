import prisma from '../src/lib/prisma';

async function monitorStale() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find all repo-tech links that haven't been detected in 30+ days
  const staleLinks = await prisma.repositoryTechnology.findMany({
    where: { lastDetectedAt: { lt: thirtyDaysAgo } },
    include: { repository: true },
    orderBy: { lastDetectedAt: 'asc' }
  });

  if (staleLinks.length === 0) {
    console.log('30-day health check: All good.');
    return;
  }

  console.warn(`⚠️ WARNING: ${staleLinks.length} technology links have exceeded the 30-day refresh window.`);

  const report = staleLinks.map(link => {
    const daysOverdue = Math.floor((new Date().getTime() - link.lastDetectedAt.getTime()) / (1000 * 60 * 60 * 24));
    return {
      repo: link.repository.fullName,
      daysOverdue
    };
  });

  console.table(report);
}

monitorStale().catch(console.error);
