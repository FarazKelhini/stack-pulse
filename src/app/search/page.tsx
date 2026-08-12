import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowLeft, Package } from 'lucide-react';
import { SearchResults } from '@/components/search/SearchResults';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q: query, category } = await searchParams;

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  if (!query && !category) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-8 py-20">
        <div className="inline-flex p-4 rounded-full bg-muted border border-border mb-4">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-extrabold">Search Technologies</h1>
        <p className="text-muted-foreground">Explore the most adopted tools in the JS/TS ecosystem</p>

        <form className="max-w-xl mx-auto flex gap-2">
          <input
            name="q"
            className="flex-1 bg-card border border-border p-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            placeholder="Search for a technology..."
          />
          <button type="submit" className="bg-primary text-primary-foreground px-6 py-4 rounded-2xl font-semibold hover:opacity-90 transition-all active:scale-95">
            Search
          </button>
        </form>
      </div>
    );
  }

  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (category) params.append('category', category);

  const res = await fetch(`${baseUrl}/api/search?${params.toString()}`);

  if (!res.ok) return <div className="p-8 text-center text-red-500">Error loading results.</div>;
  const { results } = await res.json();

  if (results.length === 0) {
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
          {category ? `Technologies in ${category}` : 'Search Results'}
        </h1>
        <p className="text-muted-foreground">
          Showing {results.length} results {query ? `for "${query}"` : `in ${category}`}
        </p>
      </header>

      <SearchResults results={results} />
    </div>
  );
}
