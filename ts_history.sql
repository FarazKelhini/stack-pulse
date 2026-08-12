SELECT "technologyId", "adoptionCount", "snapshotDate" FROM "TrendingSnapshot" WHERE "technologyId" = (SELECT "id" FROM "Technology" WHERE "slug" = 'typescript') ORDER BY "snapshotDate" DESC;
