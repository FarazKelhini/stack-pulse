import prisma from '../src/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

interface Tech {
  slug: string;
  name: string;
  npmPackage: string;
  category: string;
  description?: string;
}

async function main() {
  const dataPath = path.join(process.cwd(), 'data', 'technologies.json');
  const fileContent = await fs.readFile(dataPath, 'utf-8');
  const technologies = JSON.parse(fileContent) as Tech[];
  const slugs = technologies.map(t => t.slug);

  for (const tech of technologies) {
    await prisma.technology.upsert({
      where: { slug: tech.slug },
      update: {
        name: tech.name,
        npmPackage: tech.npmPackage,
        category: tech.category as any,
        ...(tech.description && { description: tech.description }),
        isActive: true,
      },
      create: {
        slug: tech.slug,
        name: tech.name,
        npmPackage: tech.npmPackage,
        category: tech.category as any,
        ...(tech.description && { description: tech.description }),
        isActive: true,
      },
    });
  }


  await prisma.technology.updateMany({
    where: {
      slug: { notIn: slugs },
      isActive: true,
    },
    data: { isActive: false },
  });

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
