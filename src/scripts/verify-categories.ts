import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.technology.groupBy({
    by: ['category'],
    _count: {
      id: true,
    },
    _sum: {
      repoCount: true,
    },
  });

  console.table(categories);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
