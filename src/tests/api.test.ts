import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../lib/prisma';
import { clearDatabase } from './db-utils';
import { GET as searchHandler } from '../app/api/search/route';
import { GET as trendingHandler } from '../app/api/trending/route';
import { GET as weeklyHandler } from '../app/api/trending/weekly/route';
import { GET as techHandler } from '../app/api/technology/[slug]/route';
import { NextRequest } from 'next/server';

// Helper to create a NextRequest-like object
function createRequest(url: string, ip: string = '127.0.0.1'): NextRequest {
  return new NextRequest(url, {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('API Integration Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
    // Seed some data
    await prisma.technology.createMany({
      data: [
        { slug: 'react', name: 'React', npmPackage: 'react', category: 'Frameworks', repoCount: 100 },
        { slug: 'vue', name: 'Vue', npmPackage: 'vue', category: 'Frameworks', repoCount: 50 },
        { slug: 'next-js', name: 'Next.js', npmPackage: 'next', category: 'Frameworks', repoCount: 80 },
      ],
    });
  });

  describe('GET /api/search', () => {
    it('should return results for a valid prefix match', async () => {
      const req = createRequest('http://localhost:3000/api/search?q=re');
      const res = await searchHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.results).toBeDefined();
      expect(body.results[0].slug).toBe('react');
    });

    it('should order results by repoCount DESC', async () => {
      const req = createRequest('http://localhost:3000/api/search?q='); // This might be too short, let's use a common prefix
      // Actually, the schema requires min(1). Let's use a match that hits multiple.
      // I'll add another tech that starts with 'r'
      await prisma.technology.create({
        data: { slug: 'redux', name: 'Redux', npmPackage: 'redux', category: 'StateManagement', repoCount: 150 }
      });

      const req2 = createRequest('http://localhost:3000/api/search?q=re');
      const res = await searchHandler(req2);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(body.results[0].slug).toBe('redux'); // 150 > 100
    });

    it('should return 400 for invalid query', async () => {
      const req = createRequest('http://localhost:3000/api/search?q=');
      const res = await searchHandler(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(400);
    });
  });

  describe('GET /api/trending', () => {
    it('should return 200 with empty results if no trend data exists', async () => {
      const req = createRequest('http://localhost:3000/api/trending');
      const res = await trendingHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technologies).toEqual([]);
      expect(body.snapshotDate).toBeNull();
    });

    it('should return trending technologies for the latest snapshot', async () => {
      const tech = await prisma.technology.create({
        data: { slug: 'trending-tech', name: 'Trending', npmPackage: 'trending', category: 'Frameworks', repoCount: 10 }
      });

      const today = new Date();
      today.setUTCHours(0,0,0,0);

      await prisma.trendingSnapshot.create({
        data: { technologyId: tech.id, snapshotDate: today, adoptionCount: 10, trendScore: 5.5 }
      });

      const req = createRequest('http://localhost:3000/api/trending');
      const res = await trendingHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technologies[0].slug).toBe('trending-tech');
      expect(body.technologies[0].trendScore).toBe(5.5);
    });

    it('should respect the limit parameter', async () => {
      const tech1 = await prisma.technology.create({ data: { slug: 't1', name: 'T1', npmPackage: 't1', category: 'Frameworks', repoCount: 10 } });
      const tech2 = await prisma.technology.create({ data: { slug: 't2', name: 'T2', npmPackage: 't2', category: 'Frameworks', repoCount: 10 } });

      const today = new Date();
      today.setUTCHours(0,0,0,0);
      await prisma.trendingSnapshot.createMany({
        data: [
          { technologyId: tech1.id, snapshotDate: today, adoptionCount: 10, trendScore: 5.0 },
          { technologyId: tech2.id, snapshotDate: today, adoptionCount: 10, trendScore: 4.0 },
        ]
      });

      const req = createRequest('http://localhost:3000/api/trending?limit=1');
      const res = await trendingHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(body.technologies.length).toBe(1);
      expect(body.technologies[0].slug).toBe('t1');
    });
  });

  describe('GET /api/trending/weekly', () => {
    it('should return empty response with null dates when no data exists', async () => {
      const req = createRequest('http://localhost:3000/api/trending/weekly');
      const res = await weeklyHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technologies).toEqual([]);
      expect(body.snapshotDate).toBeNull();
      expect(body.comparisonDate).toBeNull();
    });

    it('should return weekly trending technologies with correct ordering', async () => {
      const tech1 = await prisma.technology.create({
        data: { slug: 'growing-fast', name: 'Growing Fast', npmPackage: 'growing-fast', category: 'Frameworks', repoCount: 200 }
      });
      const tech2 = await prisma.technology.create({
        data: { slug: 'growing-slow', name: 'Growing Slow', npmPackage: 'growing-slow', category: 'Frameworks', repoCount: 150 }
      });
      const tech3 = await prisma.technology.create({
        data: { slug: 'declining', name: 'Declining', npmPackage: 'declining', category: 'Frameworks', repoCount: 100 }
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      // tech1: grew from 50 to 100 (+50 delta)
      // tech2: grew from 60 to 120 (+60 delta) - should be first
      // tech3: declined from 120 to 100 (-20 delta) - should be excluded
      await prisma.trendingSnapshot.createMany({
        data: [
          { technologyId: tech1.id, snapshotDate: today, adoptionCount: 100, trendScore: 0 },
          { technologyId: tech1.id, snapshotDate: sevenDaysAgo, adoptionCount: 50, trendScore: 0 },
          { technologyId: tech2.id, snapshotDate: today, adoptionCount: 120, trendScore: 0 },
          { technologyId: tech2.id, snapshotDate: sevenDaysAgo, adoptionCount: 60, trendScore: 0 },
          { technologyId: tech3.id, snapshotDate: today, adoptionCount: 100, trendScore: 0 },
          { technologyId: tech3.id, snapshotDate: sevenDaysAgo, adoptionCount: 120, trendScore: 0 },
        ]
      });

      const req = createRequest('http://localhost:3000/api/trending/weekly');
      const res = await weeklyHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technologies.length).toBe(2);
      expect(body.technologies[0].slug).toBe('growing-slow'); // 60 delta > 50 delta
      expect(body.technologies[0].weeklyDelta).toBe(60);
      expect(body.technologies[0].weeklyPercentChange).toBe(100); // (60/60)*100 = 100%
      expect(body.technologies[1].slug).toBe('growing-fast');
      expect(body.snapshotDate).toBe(today.toISOString().split('T')[0]);
      expect(body.comparisonDate).toBe(sevenDaysAgo.toISOString().split('T')[0]);
    });

    it('should use oldest snapshot as fallback when less than 7 days of history exists', async () => {
      const tech = await prisma.technology.create({
        data: { slug: 'new-tech', name: 'New Tech', npmPackage: 'new-tech', category: 'BuildTools', repoCount: 100 }
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      // Only 3 days ago (less than 7 days)
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);

      // Today: 100, 3 days ago: 40 (60 growth)
      // No 7-days-ago snapshot exists, so it should fall back to the oldest available (3 days ago)
      await prisma.trendingSnapshot.createMany({
        data: [
          { technologyId: tech.id, snapshotDate: today, adoptionCount: 100, trendScore: 0 },
          { technologyId: tech.id, snapshotDate: threeDaysAgo, adoptionCount: 40, trendScore: 0 },
        ]
      });

      const req = createRequest('http://localhost:3000/api/trending/weekly');
      const res = await weeklyHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technologies.length).toBe(1);
      expect(body.technologies[0].slug).toBe('new-tech');
      expect(body.technologies[0].weeklyDelta).toBe(60);
      // comparisonDate should still be 7 days ago (the ideal comparison date)
      expect(body.comparisonDate).toBe(sevenDaysAgo.toISOString().split('T')[0]);
    });

    it('should exclude technologies with adoptionCount < 10', async () => {
      const tech1 = await prisma.technology.create({
        data: { slug: 'small-tech', name: 'Small Tech', npmPackage: 'small-tech', category: 'Frameworks', repoCount: 50 }
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      // adoptionCount < 10 for today - should be excluded
      await prisma.trendingSnapshot.createMany({
        data: [
          { technologyId: tech1.id, snapshotDate: today, adoptionCount: 5, trendScore: 0 },
          { technologyId: tech1.id, snapshotDate: sevenDaysAgo, adoptionCount: 3, trendScore: 0 },
        ]
      });

      const req = createRequest('http://localhost:3000/api/trending/weekly');
      const res = await weeklyHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technologies.length).toBe(0);
      expect(body.technologies).toEqual([]);
    });

    it('should exclude technologies with weeklyDelta <= 0', async () => {
      const tech1 = await prisma.technology.create({
        data: { slug: 'declining-tech', name: 'Declining Tech', npmPackage: 'declining-tech', category: 'Frameworks', repoCount: 50 }
      });
      const tech2 = await prisma.technology.create({
        data: { slug: 'flat-tech', name: 'Flat Tech', npmPackage: 'flat-tech', category: 'Frameworks', repoCount: 50 }
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      await prisma.trendingSnapshot.createMany({
        data: [
          { technologyId: tech1.id, snapshotDate: today, adoptionCount: 80, trendScore: 0 },
          { technologyId: tech1.id, snapshotDate: sevenDaysAgo, adoptionCount: 100, trendScore: 0 }, // declining
          { technologyId: tech2.id, snapshotDate: today, adoptionCount: 100, trendScore: 0 },
          { technologyId: tech2.id, snapshotDate: sevenDaysAgo, adoptionCount: 100, trendScore: 0 }, // flat
        ]
      });

      const req = createRequest('http://localhost:3000/api/trending/weekly');
      const res = await weeklyHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technologies.length).toBe(0);
    });

    it('should fall back to most recent snapshot date when today has no data', async () => {
      const tech = await prisma.technology.create({
        data: { slug: 'old-tech', name: 'Old Tech', npmPackage: 'old-tech', category: 'Frameworks', repoCount: 100 }
      });

      const threeDaysAgo = new Date();
      threeDaysAgo.setUTCHours(0, 0, 0, 0);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const tenDaysAgo = new Date(threeDaysAgo);
      tenDaysAgo.setDate(threeDaysAgo.getDate() - 7);

      await prisma.trendingSnapshot.createMany({
        data: [
          // Today has no data for this tech
          // Three days ago: 100 adoption
          { technologyId: tech.id, snapshotDate: threeDaysAgo, adoptionCount: 100, trendScore: 0 },
          { technologyId: tech.id, snapshotDate: tenDaysAgo, adoptionCount: 50, trendScore: 0 },
        ]
      });

      const req = createRequest('http://localhost:3000/api/trending/weekly');
      const res = await weeklyHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technologies.length).toBe(1);
      expect(body.technologies[0].weeklyDelta).toBe(50);
      expect(body.snapshotDate).toBe(threeDaysAgo.toISOString().split('T')[0]);
    });

    it('should handle zero prior adoption correctly', async () => {
      const tech = await prisma.technology.create({
        data: { slug: 'brand-new', name: 'Brand New', npmPackage: 'brand-new', category: 'BuildTools', repoCount: 100 }
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      // Today: 100, but no prior snapshot (simulating brand new tech)
      await prisma.trendingSnapshot.create({
        data: { technologyId: tech.id, snapshotDate: today, adoptionCount: 100, trendScore: 0 }
      });

      const req = createRequest('http://localhost:3000/api/trending/weekly');
      const res = await weeklyHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      // No prior adoption, so weeklyDelta = 100, but priorAdoption was 0 -> weeklyPercentChange = null
      expect(body.technologies.length).toBe(1);
      expect(body.technologies[0].weeklyDelta).toBe(100);
      expect(body.technologies[0].weeklyPercentChange).toBeNull();
    });

    it('should respect the limit parameter', async () => {
      // Create 3 technologies with growth
      const techs = await Promise.all([
        prisma.technology.create({ data: { slug: 't1', name: 'T1', npmPackage: 't1', category: 'Frameworks', repoCount: 100 } }),
        prisma.technology.create({ data: { slug: 't2', name: 'T2', npmPackage: 't2', category: 'Frameworks', repoCount: 100 } }),
        prisma.technology.create({ data: { slug: 't3', name: 'T3', npmPackage: 't3', category: 'Frameworks', repoCount: 100 } })
      ]);

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      await prisma.trendingSnapshot.createMany({
        data: techs.flatMap((tech, i) => [
          { technologyId: tech.id, snapshotDate: today, adoptionCount: 100 + i * 10, trendScore: 0 },
          { technologyId: tech.id, snapshotDate: sevenDaysAgo, adoptionCount: 50, trendScore: 0 },
        ])
      });

      const req = createRequest('http://localhost:3000/api/trending/weekly?limit=2');
      const res = await weeklyHandler(req);
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(body.technologies.length).toBe(2);
      expect(body.technologies[0].slug).toBe('t3'); // highest delta
      expect(body.technologies[1].slug).toBe('t2');
    });
  });

  describe('GET /api/technology/[slug]', () => {
    it('should return 404 for non-existent slug', async () => {
      const req = createRequest('http://localhost:3000/api/technology/ghost');
      const res = await techHandler(req, { params: Promise.resolve({ slug: 'ghost' }) });
      expect(res).toBeDefined();
      expect(res!.status).toBe(404);
    });

    it('should return correct response shape for existing slug', async () => {
      const tech = await prisma.technology.findUnique({
        where: { slug: 'react' }
      });

      const req = createRequest('http://localhost:3000/api/technology/react');
      const res = await techHandler(req, { params: Promise.resolve({ slug: 'react' }) });
      expect(res).toBeDefined();
      const body = await res!.json();

      expect(res!.status).toBe(200);
      expect(body.technology).toBeDefined();
      expect(body.technology.slug).toBe('react');
      expect(body.technology.repoCount).toBe(100);
      expect(body.technology.totalRepositories).toBeDefined();
      expect(body.totalRepositories).toBeDefined();
      expect(body.pairings).toBeInstanceOf(Array);
      expect(body.topRepositories).toBeInstanceOf(Array);
      expect(body.snapshots).toBeInstanceOf(Array);
    });

    it('should return 400 for invalid slug format', async () => {
      const req = createRequest('http://localhost:3000/api/technology/INVALID_SLUG');
      const res = await techHandler(req, { params: Promise.resolve({ slug: 'INVALID_SLUG' }) });
      expect(res).toBeDefined();
      expect(res!.status).toBe(400);
    });
  });
});
