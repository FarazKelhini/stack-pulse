import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../lib/prisma';
import { clearDatabase } from './db-utils';
import { main as runExport } from '../scripts/export';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Export Generation', () => {
  const outputDir = path.join(process.cwd(), 'public', 'datasets');

  beforeEach(async () => {
    await clearDatabase();
    // Seed minimal data for export
    const tech = await prisma.technology.create({
      data: { slug: 'react', name: 'React', npmPackage: 'react', category: 'Frameworks', repoCount: 10 }
    });
    const repo = await prisma.repository.create({
      data: { githubId: 123n, fullName: 'org/repo', url: 'http://github.com/org/repo', stars: 100 }
    });
    await prisma.repositoryTechnology.create({
      data: { repositoryId: repo.id, technologyId: tech.id }
    });
  });

  it('should generate all export files with correct schema', async () => {
    await runExport();

    const files = ['technologies.json', 'repositories.json', 'pairings.json'];

    for (const fileName of files) {
      const filePath = path.join(outputDir, fileName);
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));

      expect(content.version).toBe('1.0');
      expect(content.generatedAt).toBeDefined();
      expect(content.commitSha).toBeDefined();
    }

    // Check technologies.json
    const techData = JSON.parse(await fs.readFile(path.join(outputDir, 'technologies.json'), 'utf-8'));
    expect(techData.technologies.length).toBe(1);
    expect(techData.technologies[0]).toHaveProperty('slug');
    expect(techData.technologies[0]).toHaveProperty('repoCount');

    // Check repositories.json
    const repoData = JSON.parse(await fs.readFile(path.join(outputDir, 'repositories.json'), 'utf-8'));
    expect(repoData.repositories.length).toBe(1);
    expect(repoData.repositories[0]).toHaveProperty('fullName');
    expect(repoData.repositories[0].technologies).toContain('react');

    // Check pairings.json
    const pairingData = JSON.parse(await fs.readFile(path.join(outputDir, 'pairings.json'), 'utf-8'));
    expect(pairingData.pairings).toBeInstanceOf(Array);
  });
});
