import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { TechDashboard } from '@/components/tech-detail/TechDashboard';

export default async function TechnologyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/technology/${slug}`);

  if (res.status === 404) notFound();
  if (!res.ok) return <div className="p-8 text-center text-red-500">Error loading technology data.</div>;
  const data = await res.json();
  const { technology, pairings, topRepositories, snapshots, totalRepositories } = data;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 py-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href="/trending" className="hover:text-foreground transition-colors">Trending</Link>
        <span>/</span>
        <span className="text-foreground">{technology.name}</span>
      </div>

      {/* 1. Header */}
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-5xl font-extrabold tracking-tight">{technology.name}</h1>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold border border-primary/20">
                {technology.category}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={`https://www.npmjs.com/package/${technology.npmPackage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                npm: {technology.npmPackage}
              </a>
            </div>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              {technology.description}
            </p>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted border border-border text-sm font-medium hover:bg-muted-foreground/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Explore
          </Link>
        </div>
      </header>

      <TechDashboard
        technology={technology}
        pairings={pairings}
        topRepositories={topRepositories}
        snapshots={snapshots}
        totalRepositories={totalRepositories ?? technology.totalRepositories}
      />
    </div>
  );
}
