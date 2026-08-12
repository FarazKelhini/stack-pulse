import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import prisma from '../lib/prisma';
import { clearDatabase } from '../tests/db-utils';
import { main as runAggregate } from '../scripts/aggregate';
import { execSync } from 'child_process';

describe('aggregate.ts Pairing Logic', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('computes correct Jaccard similarity and ordering invariant', async () => {
    // Setup: 2 technologies, 3 repos.
    // Tech A (ID: 1), Tech B (ID: 2).
    // Repo 1: A, B
    // Repo 2: A, B
    // Repo 3: A
    // |A| = 3, |B| = 2, |A ∩ B| = 2
    // Jaccard = 2 / (3 + 2 - 2) = 2/3 = 0.666...

    const t1 = await prisma.technology.create({ data: { slug: 'a', name: 'A', npmPackage: 'a', category: 'Frameworks', repoCount: 3 } });
    const t2 = await prisma.technology.create({ data: { slug: 'b', name: 'B', npmPackage: 'b', category: 'Frameworks', repoCount: 2 } });

    const r1 = await prisma.repository.create({ data: { githubId: 101, fullName: 'org/1', url: '...' } });
    const r2 = await prisma.repository.create({ data: { githubId: 102, fullName: 'org/2', url: '...' } });
    const r3 = await prisma.repository.create({ data: { githubId: 103, fullName: 'org/3', url: '...' } });

    await prisma.repositoryTechnology.createMany({
        data: [
            { repositoryId: r1.id, technologyId: t1.id },
            { repositoryId: r1.id, technologyId: t2.id },
            { repositoryId: r2.id, technologyId: t1.id },
            { repositoryId: r2.id, technologyId: t2.id },
            { repositoryId: r3.id, technologyId: t1.id },
        ]
    });

    // Run the aggregate script logic directly
    await runAggregate();

    const pairing = await prisma.technologyPairing.findFirst({
        where: {
            technologyAId: t1.id < t2.id ? t1.id : t2.id,
            technologyBId: t1.id < t2.id ? t2.id : t1.id
        }
    });

    expect(pairing).not.toBeNull();
    expect(pairing?.repositoryCount).toBe(2);
    expect(pairing?.strengthScore).toBeCloseTo(0.6667, 3);

    // Check Invariant: tA < tB
    expect(pairing!.technologyAId < pairing!.technologyBId).toBe(true);
    expect([pairing?.technologyAId, pairing?.technologyBId]).toEqual(
      [t1.id, t2.id].sort(),
    );
  });
});
