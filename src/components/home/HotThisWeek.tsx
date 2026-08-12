'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, ArrowUpRight } from 'lucide-react';

interface WeeklyTechnology {
  slug: string;
  name: string;
  category: string;
  repoCount: number;
  weeklyDelta: number;
  weeklyPercentChange: number | null;
}

function getCategoryStyles(category: string) {
  const categoryColors: Record<string, { bg: string; text: string }> = {
    Frameworks: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    Databases: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    ORMs: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
    Validation: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
    Testing: { bg: 'bg-rose-500/10', text: 'text-rose-500' },
    Authentication: { bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
    BuildTools: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
    StateManagement: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
    UILibraries: { bg: 'bg-pink-500/10', text: 'text-pink-500' },
  };
  return categoryColors[category] || { bg: 'bg-muted', text: 'text-muted-foreground' };
}

interface HotThisWeekProps {
  technologies: WeeklyTechnology[];
  showLink?: boolean;
}

export function HotThisWeek({ technologies, showLink = true }: HotThisWeekProps) {
  if (!technologies || technologies.length === 0) {
    return (
      <div className="card-modern p-6 text-center">
        <p className="text-muted-foreground italic py-4 text-sm">No breakout technologies this week yet.</p>
      </div>
    );
  }

  return (
    <div className="card-modern p-5 space-y-6 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Hot This Week
        </h2>
      </div>

      <ul className="space-y-2">
        {technologies.map((tech, i) => {
          const { bg, text } = getCategoryStyles(tech.category);
          return (
            <motion.li
              key={tech.slug}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 * i }}
              className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-xs font-mono text-muted-foreground w-4">#{i + 1}</span>
                <Link
                  href={`/technology/${tech.slug}`}
                  className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate"
                >
                  {tech.name}
                </Link>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${bg} ${text}`}>
                  {tech.category}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all whitespace-nowrap">
                <TrendingUp className="w-3 h-3" />
                {tech.weeklyPercentChange !== null
                  ? `+${tech.weeklyPercentChange}%`
                  : `+${tech.weeklyDelta} repos`}
              </div>
            </motion.li>
          );
        })}
      </ul>
      {showLink && (
        <Link
          href="/trending/weekly"
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
        >
          View all weekly <ArrowUpRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}