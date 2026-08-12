import prisma from '@/lib/prisma';
import { Suspense } from 'react';
import { FeaturedTechClient } from './FeaturedTechClient';

async function FeaturedTechData() {
  const categories = ['Frameworks', 'Databases', 'ORMs', 'Validation', 'Testing', 'Authentication', 'BuildTools', 'StateManagement', 'UILibraries'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];

  const [tech, totalRepos] = await Promise.all([
    prisma.technology.findFirst({
      where: {
        category: randomCategory as any,
        isActive: true
      },
      orderBy: { repoCount: 'desc' },
      include: {
        pairingsA: {
          take: 4,
          orderBy: { strengthScore: 'desc' },
          include: { technologyB: true }
        },
        snapshotsA: {
          take: 1,
          orderBy: { snapshotDate: 'desc' },
        }
      }
    }),
    prisma.repository.count()
  ]);

  if (!tech) return null;

  return <FeaturedTechClient tech={tech as any} totalRepos={totalRepos} />;
}

export default function FeaturedTech() {
  return (
    <Suspense fallback={
      <div className="p-6 rounded-3xl bg-card/50 border border-border animate-pulse h-full min-h-[300px] w-full" />
    }>
      <FeaturedTechData />
    </Suspense>
  );
}
