import Link from 'next/link';
import { Search, TrendingUp, Home, Zap } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full glass border-b border-border py-3 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight hover:opacity-80 transition">
            <Zap className="w-6 h-6 text-primary fill-primary" />
            <span>Stack<span className="text-primary">Pulse</span></span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/trending" className="hover:text-foreground transition-colors">Trending</Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <form action="/search" method="GET" className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              name="q"
              placeholder="Quick search..."
              className="bg-muted/50 border border-border rounded-full py-1.5 pl-9 pr-4 text-sm w-64 focus:ring-2 focus:ring-primary/50 outline-none transition-all focus:w-80"
            />
          </form>
          <button className="md:hidden p-2 text-muted-foreground">
            <Search className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
