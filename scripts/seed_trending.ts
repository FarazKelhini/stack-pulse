import prisma from '../src/lib/prisma';

async function main() {
  console.log('Seeding trending data...');
  
  const techs = await prisma.technology.findMany({
    where: { isActive: true },
    take: 10,
  });

  if (techs.length === 0) {
    console.log('No active technologies found to seed.');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshots = techs.map(tech => ({
    technologyId: tech.id,
    snapshotDate: today,
    adoptionCount: Math.floor(Math.random() * 1000) + 100,
    trendScore: Math.random() * 0.2, // Random score between 0 and 0.2
  }));

  await prisma.trendingSnapshot.createMany({
    data: snapshots,
  });

  console.log(`Successfully seeded ${snapshots.length} trending snapshots for ${today.toISOString().split('T')[0]}`);
}

main().catch(console.error);
