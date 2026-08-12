import prisma from '../src/lib/prisma';
import { processRepository } from '../src/scripts/crawl';

async function checkTechCount() {
  const tech = await prisma.technology.findFirst({ where: { slug: 'typescript' } });
  if (!tech) {
      console.log('Tech not found');
      return;
  }
  console.log('RepoCount before:', tech.repoCount);

  // We need to trigger the recompute to see the change
  const { recomputeRepoCounts } = await import('../src/scripts/crawl');
  await recomputeRepoCounts([tech.id]);

  const updatedTech = await prisma.technology.findUnique({ where: { id: tech.id } });
  console.log('RepoCount after:', updatedTech?.repoCount);
}
checkTechCount().catch(console.error);
