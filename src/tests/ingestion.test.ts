import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../lib/prisma';
import { clearDatabase } from './db-utils';
import { processRepository } from '../scripts/crawl';

describe('Repository Ingestion', () => {
  beforeEach(async () => {
    await clearDatabase();
    // Seed a technology for testing
    await prisma.technology.create({
      data: { slug: 'react', name: 'React', npmPackage: 'react', category: 'Frameworks', repoCount: 0 }
    });
  });

  it('should handle a full upsert cycle for a new repository', async () => {
    const node = {
      databaseId: 12345,
      nameWithOwner: 'vercel/next.js',
      url: 'https://github.com/vercel/next.js',
      stargazerCount: 100,
      pushedAt: new Date().toISOString(),
      object: { oid: 'sha1', text: '{"dependencies": {"react": "18.0.0"}}' },
      defaultBranchRef: { name: 'main' },
      isDisabled: false,
      isEmpty: false,
    };
    const matchedSlugs = ['react'];

    const reactTech = await prisma.technology.findUnique({ where: { slug: 'react' } });

    const result = await prisma.$transaction(async (tx) => {
      return await processRepository(tx, node, [reactTech!.id], new Set());
    });

    const repo = await prisma.repository.findUnique({ where: { id: result.repoId } });
    expect(repo).not.toBeNull();
    expect(repo?.fullName).toBe('vercel/next.js');
    expect(repo?.packageJsonSha).toBe('sha1');

    const rel = await prisma.repositoryTechnology.findFirst({
      where: { repositoryId: result.repoId }
    });
    expect(rel).not.toBeNull();

    const tech = await prisma.technology.findUnique({ where: { slug: 'react' } });
    // Note: processRepository does NOT call recomputeRepoCounts, that's done per batch in runCrawl.
    // We can check the technology ID is correct.
    expect(rel?.technologyId).toBe(tech?.id);
  });

  it('should handle updating an existing repository with a different package.json', async () => {
    // First ingestion
    const node1 = {
      databaseId: 12345,
      nameWithOwner: 'vercel/next.js',
      url: 'https://github.com/vercel/next.js',
      stargazerCount: 100,
      pushedAt: new Date().toISOString(),
      object: { oid: 'sha1', text: '{"dependencies": {"react": "18.0.0"}}' },
      defaultBranchRef: { name: 'main' },
      isDisabled: false,
      isEmpty: false,
    };
    const reactTech1 = await prisma.technology.findUnique({ where: { slug: 'react' } });
    const result1 = await prisma.$transaction(async (tx) => await processRepository(tx, node1, [reactTech1!.id], new Set()));

    // Second ingestion with updated stars and different dependencies
    const node2 = {
      ...node1,
      databaseId: 12345,
      stargazerCount: 110,
      object: { oid: 'sha2', text: '{"dependencies": {"react": "18.0.0", "next": "13.0.0"}}' },
    };
    // Assume 'next' is also in our dictionary for this test
    const next = await prisma.technology.create({
      data: { slug: 'next', name: 'Next.js', npmPackage: 'next', category: 'Frameworks', repoCount: 0 }
    });
    const react = await prisma.technology.findUnique({ where: { slug: 'react' } });

    await prisma.$transaction(async (tx) => await processRepository(tx, node2, [react!.id, next.id], new Set([react!.id])));

    const repo = await prisma.repository.findUnique({ where: { id: result1.repoId } });
    expect(repo?.stars).toBe(110);
    expect(repo?.packageJsonSha).toBe('sha2');

    const rels = await prisma.repositoryTechnology.findMany({
      where: { repositoryId: result1.repoId }
    });
    expect(rels.length).toBe(2);
  });

  it('should handle removing technologies (diff logic)', async () => {
    const node1 = {
      databaseId: 12345,
      nameWithOwner: 'vercel/next.js',
      url: 'https://github.com/vercel/next.js',
      stargazerCount: 100,
      pushedAt: new Date().toISOString(),
      object: { oid: 'sha1', text: '{"dependencies": {"react": "18.0.0"}}' },
      defaultBranchRef: { name: 'main' },
      isDisabled: false,
      isEmpty: false,
    };
    // Initial state: has react and next
    await prisma.technology.create({ data: { slug: 'next', name: 'Next.js', npmPackage: 'next', category: 'Frameworks', repoCount: 0 } });
    const react = await prisma.technology.findUnique({ where: { slug: 'react' } });
    const next = await prisma.technology.findUnique({ where: { slug: 'next' } });

    const result = await prisma.$transaction(async (tx) => await processRepository(tx, node1, [react!.id, next!.id], new Set()));

    // Update: remove 'next'
    const node2 = {
      ...node1,
      databaseId: 12345,
      object: { oid: 'sha2', text: '{"dependencies": {"react": "18.0.0"}}' },
    };
    await prisma.$transaction(async (tx) => await processRepository(tx, node2, [react!.id], new Set([react!.id, next!.id])));

    const rels = await prisma.repositoryTechnology.findMany({
      where: { repositoryId: result.repoId },
      include: { technology: true }
    });
    expect(rels.length).toBe(1);
    expect(rels[0]?.technology?.slug).toBe('react');
  });

  it('should correctly identify affected technologies for repoCount update', async () => {
    const node = {
      databaseId: 12345,
      nameWithOwner: 'vercel/next.js',
      url: 'https://github.com/vercel/next.js',
      stargazerCount: 100,
      pushedAt: new Date().toISOString(),
      object: { oid: 'sha1', text: '{"dependencies": {"react": "18.0.0"}}' },
      defaultBranchRef: { name: 'main' },
      isDisabled: false,
      isEmpty: false,
    };

    const reactTechObj = await prisma.technology.findUnique({ where: { slug: 'react' } });

    const { affectedTechIds } = await prisma.$transaction(async (tx) => {
      return await processRepository(tx, node, [reactTechObj!.id], new Set());
    });

    const reactTechAgain = await prisma.technology.findUnique({ where: { slug: 'react' } });
    expect(affectedTechIds).toContain(reactTechAgain?.id);
  });
});
