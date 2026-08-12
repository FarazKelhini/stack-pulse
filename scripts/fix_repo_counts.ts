import prisma from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

async function update() {
  const ts = await prisma.technology.findMany({select: {id: true}});
  const ids = ts.map(t => t.id);
  const result = await prisma.$executeRaw(Prisma.sql`
    UPDATE "Technology" t
    SET "repoCount" = (
      SELECT COUNT(*) FROM "RepositoryTechnology" rt
      WHERE rt."technologyId" = t.id AND rt."lastDetectedAt" > NOW() - INTERVAL '30 days'
    )
    WHERE t.id IN (${Prisma.join(ids)})
  `);
  console.log('Updated', result, 'technologies');
}

update().catch(console.error);
