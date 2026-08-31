import { Hero } from '@/components/home/Hero';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { TrendingPreview } from '@/components/home/TrendingPreview';
import { HotThisWeek } from '@/components/home/HotThisWeek';
import { FallingThisMonth } from '@/components/home/FallingThisMonth';
import { TopPerCategory } from '@/components/home/TopPerCategory';
import { TopPairings } from '@/components/home/TopPairings';
import { Features } from '@/components/home/Features';
import { LivePulse } from '@/components/home/LivePulse';
import FeaturedTech from '@/components/home/FeaturedTech';
import { Suspense } from 'react';
import { Star } from 'lucide-react';
import { cachedFetch } from '@/lib/cache';
import prisma from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import fs from 'node:fs/promises';
import path from 'node:path';

const CATEGORIES = [
  'Frameworks', 'Databases', 'ORMs', 'Validation', 'Testing',
  'Authentication', 'BuildTools', 'StateManagement', 'UILibraries'
];

async function TrendingDataWrapper() {
  // Rate limiting
  const ip = 'server';
  const rl = await rateLimit(ip);
  if (!rl.success) {
    console.warn('Rate limit exceeded for trending preview');
    return <TrendingPreview trending={[]} layout="card" />;
  }

  const fetchTrending = async () => {
    try {
      const technologies = await prisma.trendingSnapshot.findMany({
        where: {
          trendScore: { gt: 0 },
          technology: { isActive: true },
        },
        orderBy: { snapshotDate: 'desc' },
        take: 5,
        select: {
          technology: {
            select: {
              slug: true,
              name: true,
              category: true,
              repoCount: true,
            },
          },
          trendScore: true,
        },
      });
      return technologies.map((t) => ({
        ...t.technology,
        trendScore: t.trendScore,
      }));
    } catch (e) {
      console.error('Failed to fetch trending preview:', e);
      return [];
    }
  };

  const trending = await cachedFetch('home:trending', fetchTrending, 86400); // 24 hours
  return <TrendingPreview trending={trending} layout="card" />;
}

async function HotThisWeekWrapper() {
  const fetchHot = async () => {
    try {
      const dataset = JSON.parse(
        await fs.readFile(path.join(process.cwd(), 'public', 'datasets', 'weekly-trending.json'), 'utf8')
      );
      return [...(dataset.technologies ?? [])]
        .sort((a: any, b: any) => (b.weeklyPercentChange ?? 0) - (a.weeklyPercentChange ?? 0))
        .slice(0, 5);
    } catch (e) {
      console.error('Failed to load weekly trending dataset:', e);
      return [];
    }
  };

  const technologies = await cachedFetch('home:hot-this-week', fetchHot, 604800); // 7 days
  return <HotThisWeek technologies={technologies} />;
}

async function FallingThisMonthWrapper() {
  // Rate limiting
  const ip = 'server';
  const rl = await rateLimit(ip);
  if (!rl.success) {
    console.warn('Rate limit exceeded for falling technologies');
    return <FallingThisMonth technologies={[]} />;
  }

  const fetchFalling = async () => {
    try {
      const latestSnapshot = await prisma.trendingSnapshot.findFirst({
        where: { trendScore: { gt: 0 } },
        orderBy: { snapshotDate: 'desc' },
        select: { snapshotDate: true },
      });

      if (!latestSnapshot) return [];

      const falling = await prisma.trendingSnapshot.findMany({
        where: {
          snapshotDate: latestSnapshot.snapshotDate,
          trendScore: { lt: 1 },
          technology: { isActive: true },
        },
        orderBy: { trendScore: 'asc' },
        take: 10,
        select: {
          technology: {
            select: {
              slug: true,
              name: true,
              category: true,
              repoCount: true,
            },
          },
          trendScore: true,
        },
      });
      return falling.map((t) => ({
        ...t.technology,
        trendScore: t.trendScore,
      }));
    } catch (e) {
      console.error('Failed to fetch falling technologies:', e);
      return [];
    }
  };

  const technologies = await cachedFetch('home:falling', fetchFalling, 86400); // 24 hours
  return <FallingThisMonth technologies={technologies} />;
}

async function TopPerCategoryWrapper() {
  // Rate limiting
  const ip = 'server';
  const rl = await rateLimit(ip);
  if (!rl.success) {
    console.warn('Rate limit exceeded for top per category');
    return <TopPerCategory categories={[]} />;
  }

  const fetchCategories = async () => {
    try {
      return await prisma.technology.findMany({
        where: { isActive: true },
        select: { category: true },
        distinct: ['category'],
      }).then(async (c) => {
        return await Promise.all(
          c.map(async (cat) => {
            return await prisma.technology.findFirst({
              where: { category: cat.category, isActive: true },
              orderBy: { repoCount: 'desc' },
              select: { slug: true, name: true, category: true, repoCount: true },
            });
          })
        ).then((results) => results.filter((t): t is NonNullable<typeof t> => t !== null));
      });
    } catch (e) {
      console.error('Failed to fetch top per category:', e);
      return [];
    }
  };

  const categories = await cachedFetch('home:top-categories', fetchCategories, 86400); // 24 hours
  return <TopPerCategory categories={categories} />;
}

async function TopPairingsWrapper() {
  // Rate limiting
  const ip = 'server';
  const rl = await rateLimit(ip);
  if (!rl.success) {
    console.warn('Rate limit exceeded for top pairings');
    return <TopPairings pairings={[]} />;
  }

  const fetchPairings = async () => {
    try {
      const pairings = await prisma.technologyPairing.findMany({
        where: {
          technologyA: { isActive: true },
          technologyB: { isActive: true },
        },
        orderBy: { strengthScore: 'desc' },
        take: 10,
        include: {
          technologyA: { select: { name: true, slug: true } },
          technologyB: { select: { name: true, slug: true } },
        },
      });

      return pairings.map((p) => ({
        techA: p.technologyA.name,
        slugA: p.technologyA.slug,
        techB: p.technologyB.name,
        slugB: p.technologyB.slug,
        strengthScore: Number(p.strengthScore.toFixed(2)),
        repositoryCount: p.repositoryCount,
      }));
    } catch (e) {
      console.error('Failed to fetch top pairings:', e);
      return [];
    }
  };

  const pairings = await cachedFetch('home:pairings', fetchPairings, 86400); // 24 hours
  return <TopPairings pairings={pairings} />;
}

export default async function Home() {
  return (
    <div className="flex flex-col gap-2 py-8 px-6 max-w-7xl mx-auto w-full">
      <a
        href="https://github.com/FarazKelhini/stack-pulse"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-3 bg-card border border-border p-4 rounded-xl hover:bg-muted transition-colors shadow-sm"
      >
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        <span className="text-sm font-medium">Consider starring the repository on GitHub to help support open data!</span>
      </a>

      <Hero />

      <div className="py-10 space-y-8">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeaturedTech />
          <Suspense fallback={<div className="h-full min-h-[300px] bg-card/50 border border-border animate-pulse rounded-3xl" />}>
            <TrendingDataWrapper />
          </Suspense>
          <Suspense fallback={<div className="h-full min-h-[300px] bg-card/50 border border-border animate-pulse rounded-3xl" />}>
            <HotThisWeekWrapper />
          </Suspense>
          <Suspense fallback={<div className="h-full min-h-[300px] bg-card/50 border border-border animate-pulse rounded-3xl" />}>
            <FallingThisMonthWrapper />
          </Suspense>
          <Suspense fallback={<div className="h-full min-h-[300px] bg-card/50 border border-border animate-pulse rounded-3xl" />}>
            <TopPerCategoryWrapper />
          </Suspense>
          <Suspense fallback={<div className="h-full min-h-[300px] bg-card/50 border border-border animate-pulse rounded-3xl" />}>
            <TopPairingsWrapper />
          </Suspense>
        </div>
      </div>

      <div className="py-10 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Explore Ecosystem</h2>
          <p className="text-muted-foreground">Browse technologies by their primary function.</p>
        </div>
        <CategoryGrid categories={CATEGORIES} />
      </div>

      <Features />
    </div>
  );
}