'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingDown } from 'lucide-react';

export interface FallingTechnology {
  slug: string;
  name: string;
  category: string;
  repoCount: number;
  adoptionDelta: number;
  percentChange: number;
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

interface FallingThisMonthProps {
  technologies: FallingTechnology[];
}

export function FallingThisMonth({ technologies }: FallingThisMonthProps) {
  const validTechnologies = technologies?.filter(
    (tech) => tech.percentChange !== undefined && tech.percentChange !== null && tech.percentChange < 0
  );

  if (!validTechnologies || validTechnologies.length === 0) {
    return (
      <div className="card-modern p-5 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-rose-500" />
          Falling This Month
        </h2>
        <p className="text-muted-foreground italic py-4 text-sm text-center">
          There have been no falling technologies this month.
        </p>
      </div>
    );
  }

  return (
    <div className="card-modern p-5 space-y-6 flex flex-col justify-between h-full">
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            Falling This Month
          </h2>
        </div>

        <ul className="space-y-2">
          {validTechnologies.map((tech, i) => {
            const { bg, text } = getCategoryStyles(tech.category);
            return (
              <motion.li
                key={tech.slug}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
                className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border hover:border-rose-500/30 transition-all group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-xs font-mono text-muted-foreground w-4">#{i + 1}</span>
                  <Link
                    href={`/technology/${tech.slug}`}
                    className="font-bold text-sm text-foreground group-hover:text-rose-500 transition-colors truncate"
                  >
                    {tech.name}
                  </Link>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${bg} ${text}`}>
                    {tech.category}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold group-hover:bg-rose-500 group-hover:text-white transition-all whitespace-nowrap">
                  <TrendingDown className="w-3 h-3" />
                  {tech.percentChange > 0 ? `-${tech.percentChange}%` : `${tech.percentChange}%`}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
