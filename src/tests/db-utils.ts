import prisma from '../lib/prisma';

export async function clearDatabase() {
  // Use TRUNCATE CASCADE to clear all tables and their dependencies in one go
  await prisma.$executeRaw`TRUNCATE TABLE "TrendingSnapshot", "TechnologyPairing", "RepositoryTechnology", "Repository", "Technology", "CrawlJob", "CrawlState" CASCADE;`;
}
