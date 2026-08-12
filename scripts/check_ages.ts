import prisma from '../src/lib/prisma';

async function checkAges() {
  const now = new Date();

  const bins = [
    { label: '7+ days', days: 7 },
    { label: '14+ days', days: 14 },
    { label: '21+ days', days: 21 },
  ];

  for (const bin of bins) {
    const threshold = new Date(now.getTime() - bin.days * 24 * 60 * 60 * 1000);
    const count = await prisma.repository.count({
      where: { lastCrawledAt: { lt: threshold } }
    });
    console.log(`Repos not touched in ${bin.label}: ${count}`);
  }
}

checkAges().catch(console.error);
