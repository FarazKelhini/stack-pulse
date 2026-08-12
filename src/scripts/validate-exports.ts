import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

const TechSchema = z.object({
  slug: z.string(),
  name: z.string(),
  npmPackage: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  repoCount: z.number(),
});

const RepoSchema = z.object({
  fullName: z.string(),
  url: z.string(),
  stars: z.number(),
  technologies: z.array(z.string()),
});

const PairingSchema = z.object({
  technologyA: z.string(),
  technologyB: z.string(),
  repositoryCount: z.number(),
  strengthScore: z.number(),
});

const WeeklyTrendingTechSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  repoCount: z.number(),
  weeklyDelta: z.number(),
  weeklyPercentChange: z.number().nullable(),
});

const TrendingEntrySchema = z.object({
  slug: z.string(),
  name: z.string(),
  trendScore: z.number(),
  adoptionDelta: z.number(),
  snapshotDate: z.string(),
});

const BaseSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().min(1),
  commitSha: z.string().optional(),
});

const schemas = {
  'technologies.json': BaseSchema.extend({ technologies: z.array(TechSchema).min(1) }),
  'repositories.json': BaseSchema.extend({ repositories: z.array(RepoSchema).min(1) }),
  'pairings.json': BaseSchema.extend({ pairings: z.array(PairingSchema).min(1) }),
  'trending.json': BaseSchema.extend({ trending: z.array(TrendingEntrySchema).min(1) }),
  'weekly-trending.json': BaseSchema.extend({ technologies: z.array(WeeklyTrendingTechSchema).min(1) }),
};

async function main() {
  const outputDir = path.join(process.cwd(), 'public', 'datasets');
  const files = await fs.readdir(outputDir);

  for (const filename of files) {
    if (!filename.endsWith('.json')) continue;

    logger.info({ service: 'validate-exports', operation: 'validate', file: filename });

    try {
      const content = await fs.readFile(path.join(outputDir, filename), 'utf8');
      const data = JSON.parse(content);

      const schema = schemas[filename as keyof typeof schemas];
      if (!schema) {
        throw new Error(`No schema for file: ${filename}`);
      }

      schema.parse(data);
      logger.info({ service: 'validate-exports', operation: 'validate', file: filename, status: 'success' });
    } catch (err: any) {
      logger.error({ service: 'validate-exports', operation: 'validate', file: filename, status: 'error', error: err.message });
      process.exit(1);
    }
  }
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
