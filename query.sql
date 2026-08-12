SELECT "technologyId", "adoptionCount", "snapshotDate" FROM "TrendingSnapshot" WHERE "technologyId" IN (SELECT "id" FROM "Technology" WHERE "slug" = 'typescript') ORDER BY "snapshotDate" DESC;
