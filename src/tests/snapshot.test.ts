import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../lib/prisma';
import { clearDatabase } from './db-utils';
import { main as runSnapshot } from '../scripts/snapshot';

describe('snapshot.ts integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('should create snapshots for technologies', async () => {
    // Setup mock technology
    const tech = await prisma.technology.create({
      data: { slug: 'test-tech', name: 'Test', npmPackage: 'test-tech', category: 'Testing', repoCount: 20 }
    });

    // Run the script logic directly
    await runSnapshot();

    const snap = await prisma.trendingSnapshot.findFirst({ where: { technologyId: tech.id } });
    expect(snap).not.toBeNull();
    expect(snap?.adoptionCount).toBe(20);
  });
});
