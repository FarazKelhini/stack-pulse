import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowLeft, Package } from 'lucide-react';
import { SearchResults } from '@/components/search/SearchResults';
import prisma from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const SearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
}).refine(data => data.q || data.category, {
  message: "Either q or category must be provided",
  path: ["q"],
});

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q: query, category } = await searchParams;

  // Rate limiting
  const ip = 'server';
  const rl = await rateLimit(ip);
  if (!rl.success) {
    return (
      <div className="p-8 text-center text-red-500">Rate limit exceeded. Please try again later.</div>
    );
  }

  // Validate search parameters
  const result = SearchSchema.safeParse({ q: query, category });
  if (!result.success) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <div className="inline-flex p-4 rounded-full bg-muted border border-border mb-4">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Invalid search</h2>
        <p className="text-muted-foreground">Please provide either a query or category.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    );
  }

  const { q, category: searchCategory } = result.data;

  // Build Prisma where clause
  const where: any = {
    isActive: true,
  };

  if (searchCategory) {
    where.category = searchCategory;
  }

  if (q) {
    where.OR = [
      { slug: { startsWith: q, mode: "insensitive" } },
      { name: { startsWith: q, mode: "insensitive" } },
    ];
  }

  const technologies = await prisma.technology.findMany({
    where,
    orderBy: { repoCount: "desc" },
    take: 20,
    select: {
      slug: true,
      name: true,
      category: true,
      repoCount: true,
      description: true,
    },
  });

  if (!technologies || technologies.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <div className="inline-flex p-4 rounded-full bg-muted border border-border mb-4">
          <Package className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">No results found</h2>
        <p className="text-muted-foreground">Try adjusting your search terms or exploring a different category.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 py-12">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground">Search</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          {searchCategory ? `Technologies in ${searchCategory}` : 'Search Results'}
        </h1>
        <p className="text-muted-foreground">
          Showing {technologies.length} results {query ? `for "${query}"` : `in ${searchCategory}`}
        </p>
      </header>

      <SearchResults results={technologies} />
    </div>
  );
}