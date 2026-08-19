import { TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { TrendingList } from '@/components/trending/TrendingList';

export const dynamic = 'force-dynamic';

export default async function TrendingPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/trending`);

  if (!res.ok) return <div className="p-8 text-center text-red-500">Error loading trends.</div>;
  const { technologies, snapshotDate } = await res.json();

  if (!technologies || technologies.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <div className="inline-flex p-4 rounded-full bg-muted border border-border mb-4">
          <BarChart3 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Trend data not yet available</h2>
        <p className="text-muted-foreground">Check back after the next pipeline run for the latest adoption trends.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 py-12">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground">Trending</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
              <TrendingUp className="w-10 h-10 text-primary" />
              Trending Technologies
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Latest snapshot: <span className="text-foreground font-medium">{snapshotDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Trend Score is a log-scaled growth index: (current adoption / prior adoption) × log10(current adoption + 10), weighted so both the rate of change and the technology's overall scale matter.
            </div>
          </div>
        </div>
      </header>

      <TrendingList technologies={technologies} />
    </div>
  );
}
