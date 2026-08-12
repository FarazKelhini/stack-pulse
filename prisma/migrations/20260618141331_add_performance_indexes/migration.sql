-- Search: prefix match on slug and name
CREATE INDEX idx_technology_slug_prefix ON "Technology" (lower(slug) text_pattern_ops);
CREATE INDEX idx_technology_name_prefix ON "Technology" (lower(name) text_pattern_ops);
CREATE INDEX idx_technology_repo_count ON "Technology"("repoCount" DESC);

-- Trending: date-ordered snapshots
CREATE INDEX idx_snapshot_date ON "TrendingSnapshot"("snapshotDate" DESC, "trendScore" DESC);
CREATE INDEX idx_snapshot_tech_date ON "TrendingSnapshot"("technologyId", "snapshotDate" DESC);

-- Pairings: lookups by either technology
CREATE INDEX idx_pairing_a ON "TechnologyPairing"("technologyAId");
CREATE INDEX idx_pairing_b ON "TechnologyPairing"("technologyBId");

-- Repository technology lookups
CREATE INDEX idx_repo_tech_tech ON "RepositoryTechnology"("technologyId");-- This is an empty migration.