'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Tag, Database } from 'lucide-react';

export interface CategoryTopTech {
  category: string;
  name: string;
  slug: string;
  repoCount: number;
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

function formatCount(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

interface TopPerCategoryProps {
  categories: CategoryTopTech[];
}

export function TopPerCategory({ categories }: TopPerCategoryProps) {
  if (!categories || categories.length === 0) {
    return (
      <div className="card-modern p-5 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          Top Per Category
        </h2>
        <p className="text-muted-foreground italic py-4 text-sm text-center">
          Category data is currently being gathered...
        </p>
      </div>
    );
  }

  return (
    <div className="card-modern p-5 space-y-6 flex flex-col justify-between h-full">
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            Top Per Category
          </h2>
        </div>

        <ul className="space-y-2">
          {categories.map((cat, i) => {
            const { bg, text } = getCategoryStyles(cat.category);
            return (
              <motion.li
                key={cat.category}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
                className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${bg} ${text} shrink-0`}>
                    {cat.category}
                  </span>
                  <Link
                    href={`/technology/${cat.slug}`}
                    className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate"
                  >
                    {cat.name}
                  </Link>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium whitespace-nowrap shrink-0">
                  <Database className="w-3 h-3" />
                  {formatCount(cat.repoCount)}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
