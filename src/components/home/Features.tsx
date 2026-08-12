'use client';
import { motion } from 'framer-motion';
import { BarChart3, Globe, Zap, ShieldCheck } from 'lucide-react';

const FEATURES = [
  {
    title: 'Real-time Adoption',
    description: 'We track thousands of repositories daily to provide accurate, up-to-the-minute adoption metrics.',
    icon: BarChart3,
    color: 'text-blue-500',
  },
  {
    title: 'Ecosystem Mapping',
    description: 'Discover how technologies are paired together and identify the most common stack combinations.',
    icon: Globe,
    color: 'text-indigo-500',
  },
  {
    title: 'Trend Forecasting',
    description: 'Identify emerging tools before they go mainstream with our proprietary trend scoring algorithm.',
    icon: Zap,
    color: 'text-yellow-500',
  },
  {
    title: 'Data Verified',
    description: 'All data is aggregated directly from open-source metadata to ensure transparency and accuracy.',
    icon: ShieldCheck,
    color: 'text-green-500',
  },
];

export function Features() {
  return (
    <section className="py-10 space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold tracking-tight">Powered by Data</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Everything we show is derived from real-world usage across the open-source ecosystem.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="card-modern p-6 space-y-4"
          >
            <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${feature.color}`}>
              <feature.icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg">{feature.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
