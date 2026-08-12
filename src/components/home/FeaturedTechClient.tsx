'use client';
import { motion } from 'framer-motion';
import { Zap, ArrowUpRight, Share2, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface FeaturedTechClientProps {
  tech: {
    slug: string;
    name: string;
    description: string | null;
    category: string;
    repoCount: number;
    pairingsA: Array<{
      technologyBId: string;
      technologyB: {
        slug: string;
        name: string;
      };
    }>;
    snapshotsA: Array<{
      trendScore: number;
    }>;
  };
  totalRepos: number;
}

export function FeaturedTechClient({ tech, totalRepos }: FeaturedTechClientProps) {
  const latestSnapshot = tech.snapshotsA[0];
  const trendScore = latestSnapshot ? latestSnapshot.trendScore : 0;
  const isPositive = trendScore >= 0;

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 shadow-xl space-y-6 transition-all hover:shadow-primary/5 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest">
            <Zap className="w-3 h-3 fill-primary" />
            Featured Insight
          </div>
          <Link href={`/technology/${tech.slug}`} className="group inline-block">
            <h3 className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
              {tech.name}
            </h3>
          </Link>
          <p className="text-sm text-muted-foreground">{tech.description || 'A leading technology in the JS ecosystem.'}</p>
        </div>
        <Link
          href={`/technology/${tech.slug}`}
          className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all group"
        >
          <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="p-3 rounded-2xl bg-card/50 border border-border hover:border-primary/40 hover:bg-muted/40 transition-all group flex items-center justify-between"
        >
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">Adoption</span>
          <span className="text-sm font-bold">
            {tech.repoCount.toLocaleString()}
            <span className="text-xs text-muted-foreground font-normal ml-1">/{totalRepos.toLocaleString()}</span>
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="p-3 rounded-2xl bg-card/50 border border-border hover:border-primary/40 hover:bg-muted/40 transition-all group flex items-center justify-between"
        >
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">Category</span>
          <span className="text-sm font-bold truncate">{tech.category}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="p-3 rounded-2xl bg-card/50 border border-border hover:border-primary/40 hover:bg-muted/40 transition-all group flex items-center justify-between"
        >
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">Trend Score</span>
          <span className={`text-sm font-bold flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            <TrendingUp className={`w-4 h-4 ${!isPositive && 'rotate-180'}`} />
            {isPositive ? '+' : ''}{trendScore.toFixed(2)}
          </span>
        </motion.div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Share2 className="w-3 h-3" />
          Commonly paired with
        </div>
        <div className="flex flex-wrap gap-2">
          {tech.pairingsA.map((pairing) => (
            <Link
              key={pairing.technologyBId}
              href={`/technology/${pairing.technologyB.slug}`}
              className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              {pairing.technologyB.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
