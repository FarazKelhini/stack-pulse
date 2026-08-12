'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, Database, ArrowUpRight } from 'lucide-react';

interface TrendingPreviewProps {
  trending: any[];
  layout?: 'card' | 'bar';
}

function formatCount(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

export function TrendingPreview({ trending, layout = 'card' }: TrendingPreviewProps) {
  if (!trending || trending.length === 0) {
    return (
      <div className={`${layout === 'card' ? 'card-modern p-6 text-center' : 'w-full py-4 px-6 bg-card border-y border-border text-center'}`}>
        <p className="text-muted-foreground italic py-4 text-sm">Trend data is currently being gathered...</p>
      </div>
    );
  }

  if (layout === 'bar') {
    return (
      <div className="w-full py-4 px-6 bg-card border-y border-border flex items-center gap-6 overflow-hidden">
        <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest whitespace-nowrap">
          <TrendingUp className="w-3 h-3" />
          Trending Now
        </div>
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          {trending.map((tech, i) => (
            <motion.a
              key={tech.slug}
              href={`/technology/${tech.slug}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className="flex items-center gap-2 whitespace-nowrap text-sm font-medium hover:text-primary transition-colors group"
            >
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">#{i + 1}</span>
              <span className="font-bold">{tech.name}</span>
              <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                +{tech.trendScore.toFixed(2)}
              </span>
            </motion.a>
          ))}
          <Link 
            href="/trending" 
            className="text-xs text-muted-foreground hover:text-primary transition-colors ml-auto"
          >
            View all →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-modern p-5 space-y-6 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Trending
        </h2>
      </div>

      <ul className="space-y-2">
        {trending.map((tech, i) => (
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
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                <Database className="w-3 h-3" />
                {formatCount(tech.repoCount)}
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <TrendingUp className="w-3 h-3" />
              +{tech.trendScore.toFixed(2)}
            </div>
          </motion.li>
        ))}
      </ul>
      <Link
        href="/trending"
        className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
      >
        View all trending <ArrowUpRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
