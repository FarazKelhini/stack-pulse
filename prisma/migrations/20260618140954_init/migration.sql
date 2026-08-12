-- CreateEnum
CREATE TYPE "TechnologyCategory" AS ENUM ('Frameworks', 'Databases', 'ORMs', 'Validation', 'Testing', 'Authentication', 'BuildTools', 'StateManagement', 'UILibraries');

-- CreateEnum
CREATE TYPE "CrawlJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Technology" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "npmPackage" TEXT NOT NULL,
    "category" "TechnologyCategory" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "repoCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubId" BIGINT NOT NULL,
    "fullName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "lastPushedAt" TIMESTAMP(3),
    "lastCrawledAt" TIMESTAMP(3),
    "packageJsonSha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryTechnology" (
    "repositoryId" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,

    CONSTRAINT "RepositoryTechnology_pkey" PRIMARY KEY ("repositoryId","technologyId")
);

-- CreateTable
CREATE TABLE "TechnologyPairing" (
    "technologyAId" TEXT NOT NULL,
    "technologyBId" TEXT NOT NULL,
    "repositoryCount" INTEGER NOT NULL,
    "strengthScore" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnologyPairing_pkey" PRIMARY KEY ("technologyAId","technologyBId")
);

-- CreateTable
CREATE TABLE "TrendingSnapshot" (
    "technologyId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "adoptionCount" INTEGER NOT NULL,
    "trendScore" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "TrendingSnapshot_pkey" PRIMARY KEY ("technologyId","snapshotDate")
);

-- CreateTable
CREATE TABLE "CrawlState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "activeWindow" INTEGER NOT NULL DEFAULT 1,
    "cursors" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "status" "CrawlJobStatus" NOT NULL,
    "repositoriesProcessed" INTEGER NOT NULL DEFAULT 0,
    "repositoriesMatched" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Technology_slug_key" ON "Technology"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Technology_npmPackage_key" ON "Technology"("npmPackage");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubId_key" ON "Repository"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

-- AddForeignKey
ALTER TABLE "RepositoryTechnology" ADD CONSTRAINT "RepositoryTechnology_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryTechnology" ADD CONSTRAINT "RepositoryTechnology_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "Technology"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyPairing" ADD CONSTRAINT "TechnologyPairing_technologyAId_fkey" FOREIGN KEY ("technologyAId") REFERENCES "Technology"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyPairing" ADD CONSTRAINT "TechnologyPairing_technologyBId_fkey" FOREIGN KEY ("technologyBId") REFERENCES "Technology"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendingSnapshot" ADD CONSTRAINT "TrendingSnapshot_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "Technology"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
