'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export function SearchResults({ results }: { results: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {results.map((tech, i) => (
        <motion.div
          key={tech.slug}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        >
          <Link href={`/technology/${tech.slug}`} className="card-modern block p-6 group">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{tech.name}</h3>
              <span className="text-xs font-medium bg-muted px-2 py-1 rounded-md text-muted-foreground">
                {tech.category}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4 line-clamp-2">
              {tech.description}
            </p>
            <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              View Details <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
