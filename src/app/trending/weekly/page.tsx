import { TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';
import { HotThisWeek } from '@/components/home/HotThisWeek';

export const dynamic = 'force-dynamic';

interface WeeklyTechnology {
  slug: string;
  name: string;
  category: string;
  repoCount: number;
  weeklyDelta: number;
  weeklyPercentChange: number | null;
}

export default async function WeeklyTrendingPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/trending/weekly?limit=50`);

  if (!res.ok) return <div className="p-8 text-center text-red-500">Error loading weekly trends.</div>;
  const data = await res.json();
  const { technologies, snapshotDate, comparisonDate } = data;

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
              Compared: <span className="text-foreground font-medium">{comparisonDate}</span>
              {' '}to <span className="text-foreground font-medium">{snapshotDate}</span>
            </div>
          </div>
        </div>
      </header>

      <HotThisWeek technologies={technologies} showLink={false} />
    </div>
  );
}
