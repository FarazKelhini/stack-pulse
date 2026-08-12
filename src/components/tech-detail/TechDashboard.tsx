'use client';
import { motion } from 'framer-motion';
import { TrendingUp, Database, Layers, Star, Zap, Calendar } from 'lucide-react';
import { TrendChart } from '@/components/TrendChart';
import Link from 'next/link';

interface TechDashboardProps {
  technology: any;
  pairings: any[];
  topRepositories: any[];
  snapshots: any[];
  totalRepositories?: number;
}

export function TechDashboard({ technology, pairings, topRepositories, snapshots, totalRepositories }: TechDashboardProps) {
  const totalRepos = totalRepositories ?? technology.totalRepositories;
  const trendDirection = technology.trendScore > 0 ? '↗' : '↘';
  const trendColor = technology.trendScore > 0 ? 'text-primary' : 'text-red-500';

  // Compute weekly delta from snapshots (ascending order, last 30 days)
  let weeklyDelta: number | null = null;
  if (snapshots && snapshots.length >= 2) {
    const lastSnap = snapshots[snapshots.length - 1];
    // Find snapshot 7 days before last, or oldest if fewer than 7 days
    const priorSnap = snapshots.length > 7 ? snapshots[snapshots.length - 8] : snapshots[0];
    weeklyDelta = lastSnap.adoptionCount - priorSnap.adoptionCount;
  }

  return (
    <div className="space-y-12">
      {/* 2. Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-modern p-6 flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <Database className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Total Adoptions</span>
          </div>
          <div className="text-3xl font-mono font-bold">
            {technology.repoCount.toLocaleString()}
            {totalRepos != null && (
              <span className="text-base font-sans font-normal text-muted-foreground ml-1">
                /{totalRepos.toLocaleString()}
              </span>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-modern p-6 flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Trend Score</span>
          </div>
          <div className={`text-3xl font-mono font-bold ${trendColor}`}>
            {technology.trendScore.toFixed(2)} {trendDirection}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-modern p-6 flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Weekly Delta</span>
          </div>
          <div className={`text-3xl font-mono font-bold ${weeklyDelta !== null ? (weeklyDelta > 0 ? 'text-primary' : 'text-red-500') : 'text-muted-foreground'}`}>
            {weeklyDelta !== null ? (weeklyDelta > 0 ? '+' : '') + weeklyDelta : '-'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-modern p-6 flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <Zap className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Ecosystem Status</span>
          </div>
          <div className="text-3xl font-bold text-foreground">Active</div>
        </motion.div>
      </div>

      {/* 3. Main Trend Chart */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            30-Day Adoption Trend
          </h2>
        </div>
        <div className="card-modern p-8 text-primary">
          <div className="w-full h-64">
            <TrendChart
              data={snapshots.map((s: any, i: number, arr: any[]) =>
                i === 0 ? 0 : s.adoptionCount - arr[i - 1].adoptionCount
              )}
              width={1000}
              height={256}
            />
          </div>
          <div className="flex justify-between mt-4 text-xs font-mono text-muted-foreground">
            <span>30 days ago (Daily Growth)</span>
            <span>Current Snapshot</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* 4. Pairings */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              Commonly Paired With
            </h2>
          </div>
          <div className="space-y-4">
            {pairings.map((p: any) => (
              <div key={p.slug} className="card-modern p-4 group">
                <div className="flex justify-between mb-3">
                  <Link href={`/technology/${p.slug}`} className="font-bold text-foreground group-hover:text-primary transition-colors">
                    {p.name}
                  </Link>
                  <span className="text-sm font-mono font-medium text-muted-foreground">{(p.strengthScore * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.strengthScore * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="bg-primary h-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Top Repositories */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-primary" />
              Top Repositories
            </h2>
          </div>
          <div className="space-y-4">
            {topRepositories.map((repo: any) => (
              <a
                key={repo.url}
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card-modern block p-4 group hover:border-primary/50 transition-all"
              >
                <div className="font-bold text-foreground truncate mb-1">{repo.fullName}</div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    {repo.stars.toLocaleString()} stars
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function BarChart3({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
