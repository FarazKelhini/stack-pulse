import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Box,
  Database,
  ShieldCheck,
  TestTube,
  Lock,
  Wrench,
  Cpu,
  Layout,
  Zap,
  ChevronRight,
  Package
} from 'lucide-react';
import prisma from '@/lib/prisma';

const CATEGORY_ICONS: Record<string, any> = {
  'Frameworks': Layout,
  'Databases': Database,
  'ORMs': Cpu,
  'Validation': ShieldCheck,
  'Testing': TestTube,
  'Authentication': Lock,
  'BuildTools': Wrench,
  'StateManagement': Zap,
  'UILibraries': Box,
};

async function CategoryRow({ category }: { category: string }) {
  const topTechs = await prisma.technology.findMany({
    where: { category: category as any, isActive: true },
    orderBy: { repoCount: 'desc' },
    take: 4,
    select: { name: true, slug: true }
  });

  const totalCount = await prisma.technology.count({
    where: { category: category as any, isActive: true }
  });

  const Icon = CATEGORY_ICONS[category] || Box;

  return (
    <Link
      href={`/search?category=${encodeURIComponent(category)}`}
      className="group relative flex items-center justify-between p-4 rounded-2xl bg-card/50 border border-border hover:border-primary/50 transition-all duration-300 hover:bg-card hover:shadow-lg hover:shadow-primary/5 hover:translate-x-1"
    >
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="p-2 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-foreground group-hover:text-primary transition-colors">
            {category}
          </span>
          <div className="flex items-center gap-2 mt-1">
            {topTechs.map((tech, i) => (
              <span key={tech.slug} className="text-[10px] text-muted-foreground group-hover:text-primary/60 transition-colors">
                {tech.name.length > 10 ? tech.name.substring(0, 10) + '...' : tech.name}{i < topTechs.length - 1 ? ' •' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5 text-right hidden sm:flex">
          <span className="text-xs font-medium text-muted-foreground">
            {totalCount}
          </span>
          <Package className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="p-1.5 rounded-full bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}

export async function CategoryGrid({ categories }: { categories: string[] }) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between px-2">
        <div className="space-y-1">

        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <CategoryRow key={cat} category={cat} />
        ))}
      </div>
    </div>
  );
}
