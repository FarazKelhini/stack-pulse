import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border py-12 px-6 mt-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span>Stack<span className="text-primary">Pulse</span></span>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-left">
            Tracking the heartbeat of the JS/TS ecosystem.
          </p>
        </div>

        <div className="flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link href="/trending" className="hover:text-foreground transition-colors">Trending</Link>
          <Link href="/search" className="hover:text-foreground transition-colors">Explore</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
        </div>

        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} StackPulse. Built for developers.
        </div>
      </div>
    </footer>
  );
}
