import { TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';
import { HotThisWeek } from '@/components/home/HotThisWeek';
import prisma from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TrendingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

interface WeeklyTechnology {
  slug: string;
  name: string;
  category: string;
  repoCount: number;
  weeklyDelta: number;
  weeklyPercentChange: number | null;
}

export default async function WeeklyTrendingPage() {
  // Rate limiting
  const ip = 'server';
  const rl = await rateLimit(ip);
  if (!rl.success) {
    return (
      <div className="p-8 text-center text-red-500">Rate limit exceeded. Please try again later.</div>
    );
  }

  // Get weekly trending data from datasets
  const { HotThisWeek } = await import('@/components/home/HotThisWeek');
  const fs = await import('fs/promises');
  const path = await import('path');

  let technologies: WeeklyTechnology[] = [];
  try {
    const dataset = JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'public', 'datasets', 'weekly-trending.json'), 'utf8')
    );
    technologies = [...(dataset.technologies ?? [])]
      .sort((a: WeeklyTechnology, b: WeeklyTechnology) => (b.weeklyPercentChange ?? 0) - (a.weeklyPercentChange ?? 0))
      .slice(0, 50);
  } catch (e) {
    console.error('Failed to load weekly trending dataset:', e);
  }

  // Get snapshot and comparison dates
  const latestSnapshot = await prisma.trendingSnapshot.findFirst({
    where: { trendScore: { gt: 0 } },
    orderBy: { snapshotDate: "desc" },
    select: { snapshotDate: true },
  });

  if (!latestSnapshot) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <div className="inline-flex p-4 rounded-full bg-muted border border-border mb-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Weekly trending data not available</h2>
        <p className="text-muted-foreground">No trend data available yet.</p>
      </div>
    );
  }

  const snapshotDate = latestSnapshot.snapshotDate.toISOString().split("T")[0];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12 py-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href="/trending" className="hover:text-foreground transition-colors">Trending</Link>
        <span>/</span>
        <span className="text-foreground">Weekly</span>
      </div>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
              <TrendingUp className="w-10 h-10 text-primary" />
              Weekly Breakout
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Compared: <span className="text-foreground font-medium">Previous week</span>
              {' '}to <span className="text-foreground font-medium">{snapshotDate}</span>
            </div>
          </div>
        </div>
      </header>

      <HotThisWeek technologies={technologies} showLink={false} />
    </div>
  );
}