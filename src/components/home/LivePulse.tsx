'use client';
import { motion } from 'framer-motion';

interface Metric {
  label: string;
  value: string;
  description: string;
}

interface LivePulseProps {
  metrics: Metric[];
}

export function LivePulse({ metrics }: LivePulseProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full py-8">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 + index * 0.1 }}
          className="p-6 rounded-3xl bg-card border border-border shadow-sm text-center space-y-2 hover:border-primary/20 transition-colors"
        >
          <div className="text-4xl font-extrabold text-foreground">{metric.value}</div>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {metric.label}
          </div>
          <div className="text-xs text-muted-foreground/60">{metric.description}</div>
        </motion.div>
      ))}
    </div>
  );
}
