'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, ArrowRight } from 'lucide-react';
import { MetricsRow } from './MetricsRow';

interface Metric {
  label: string;
  value: string;
  description: string;
}

interface HeroProps {
  metrics?: React.ReactNode;
  rightColumn?: React.ReactNode;
}

export function Hero({ metrics, rightColumn }: HeroProps) {
  return (
    <section className="relative w-full py-5">
      {/* Background Glow Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <div className={`grid grid-cols-1 ${rightColumn ? 'lg:grid-cols-2' : 'max-w-4xl'} gap-12 items-start mx-auto px-6`}>
        <div className="flex flex-col items-center text-center space-y-8 pt-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Real-time Ecosystem Insights
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-balance leading-[1.1] animate-in fade-in slide-in-from-left-4 duration-700 fill-mode-forwards max-w-4xl">
            Track the <span className="text-primary">heartbeat</span> of the modern web.
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl animate-in fade-in slide-in-from-left-4 duration-700 delay-100 fill-mode-forwards">
            Discover emerging patterns, track technology adoption, and make data-driven decisions for your next stack.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full max-w-2xl relative group"
          >
            <form action="/search" method="GET" className="relative flex items-center">
              <Search className="absolute left-6 w-6 h-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                name="q"
                className="w-full bg-card border border-border py-6 pl-16 pr-32 rounded-3xl shadow-card focus:ring-2 focus:ring-primary/50 outline-none transition-all text-xl"
                placeholder="Search for a technology..."
              />
              <button
                type="submit"
                className="absolute right-3 bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-semibold hover:opacity-90 transition-all active:scale-95 flex items-center gap-2 text-lg"
              >
                Search
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
            <div className="mt-10 flex justify-center">
              <Link
                href="/network"
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-card border border-primary/20 hover:border-primary/50 text-foreground transition-all duration-300 shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.6)] active:scale-95"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-3 font-semibold text-lg">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-violet-500 border-2 border-card" />
                    <div className="w-6 h-6 rounded-full bg-fuchsia-500 border-2 border-card" />
                  </div>
                  Explore Network Visualization
                  <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </div>
          </motion.div>

          {metrics && <div className="w-full pt-8">{metrics}</div>}
        </div>

        {rightColumn && (
          <div className="relative flex flex-col gap-16 pt-16">
            {rightColumn}
          </div>
        )}
      </div>
    </section>
  );
}
