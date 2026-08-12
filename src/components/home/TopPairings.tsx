'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';

export interface PairingItem {
  techA: string;
  slugA: string;
  techB: string;
  slugB: string;
  strengthScore: number;
  repositoryCount: number;
}

interface TopPairingsProps {
  pairings: PairingItem[];
}

export function TopPairings({ pairings }: TopPairingsProps) {
  if (!pairings || pairings.length === 0) {
    return (
      <div className="card-modern p-5 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Top Pairings
        </h2>
        <p className="text-muted-foreground italic py-4 text-sm text-center">
          Pairing affinity data is currently being calculated...
        </p>
      </div>
    );
  }

  return (
    <div className="card-modern p-5 space-y-6 flex flex-col justify-between h-full">
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Top Pairings
          </h2>
        </div>

        <ul className="space-y-2">
          {pairings.map((pair, i) => (
            <motion.li
              key={`${pair.slugA}-${pair.slugB}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-2 overflow-hidden text-sm">
                <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                <div className="flex items-center gap-1 overflow-hidden truncate">
                  <Link
                    href={`/technology/${pair.slugA}`}
                    className="font-bold text-foreground group-hover:text-primary transition-colors truncate"
                  >
                    {pair.techA}
                  </Link>
                  <span className="text-muted-foreground text-xs shrink-0">+</span>
                  <Link
                    href={`/technology/${pair.slugB}`}
                    className="font-bold text-foreground group-hover:text-primary transition-colors truncate"
                  >
                    {pair.techB}
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold font-mono group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                {pair.strengthScore.toFixed(2)}
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
