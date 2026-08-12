'use client';
import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export function TrendingList({ technologies }: { technologies: any[] }) {
  return (
    <div className="space-y-4">
      {technologies.map((tech, i) => {
        const isTopThree = i < 3;
        return (
          <motion.div
            key={tech.slug}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Link href={`/technology/${tech.slug}`} className="card-modern flex items-center justify-between p-4 group hover:border-primary/50 transition-all">
              <div className="flex items-center gap-6">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-colors ${
                  isTopThree
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                }`}>
                  {i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{tech.name}</h3>
                    {isTopThree && <TrendingUp className="w-3 h-3 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{tech.category}</p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Adoptions</div>
                  <div className="font-mono text-sm font-medium">{tech.repoCount?.toLocaleString() || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Trend Score</div>
                  <div className="text-lg font-mono font-bold text-primary">
                    +{tech.trendScore.toFixed(2)}
                  </div>
                </div>
                <div className="p-2 rounded-full bg-muted group-hover:bg-primary/20 group-hover:text-primary transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
