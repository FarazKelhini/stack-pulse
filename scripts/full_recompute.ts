import prisma from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

async function fullRecompute() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const techs = await prisma.technology.findMany({ select: { id: true } });
  const ids = techs.map(t => t.id);

  // We batch this if there are many techs, but for 157 it's fine.
  const result = await prisma.$executeRaw`
    UPDATE "Technology" t
    SET "repoCount" = (
      SELECT COUNT(*) FROM "RepositoryTechnology" rt
      WHERE rt."technologyId" = t.id AND rt."lastDetectedAt" > ${thirtyDaysAgo}
    )
    WHERE t.id IN (${Prisma.join(ids)})
  `;
  console.log('Recomputed repo counts for', result, 'technologies');
}

fullRecompute().catch(console.error);
