import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { TechDashboard } from '@/components/tech-detail/TechDashboard';
import prisma from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export default async function TechnologyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Rate limiting
  const ip = 'server';
  const rl = await rateLimit(ip);
  if (!rl.success) {
    return <div className="p-8 text-center text-red-500">Rate limit exceeded. Please try again later.</div>;
  }

  // Fetch technology data directly from database
  const tech = await prisma.technology.findUnique({
    where: { slug },
    include: {
      pairingsA: {
        orderBy: { strengthScore: "desc" },
        take: 10,
        include: { technologyB: { select: { slug: true, name: true } } },
      },
      pairingsB: {
        orderBy: { strengthScore: "desc" },
        take: 10,
        include: { technologyA: { select: { slug: true, name: true } } },
      },
      snapshotsA: {
        orderBy: { snapshotDate: "desc" },
        take: 30,
      },
    },
  });

  if (!tech) {
    notFound();
  }

  // Get latest trend score and total repo count
  const [latestSnapshot, totalRepositories] = await Promise.all([
    prisma.trendingSnapshot.findFirst({
      where: { technologyId: tech.id },
      orderBy: { snapshotDate: "desc" },
    }),
    prisma.repository.count(),
  ]);

  // Top repositories (from RepositoryTechnology table)
  const topRepositories = await prisma.repositoryTechnology.findMany({
    where: { technologyId: tech.id },
    orderBy: { repository: { stars: "desc" } },
    take: 10,
    include: { repository: { select: { fullName: true, url: true, stars: true } } },
  });

  const pairings = [
    ...tech.pairingsA.map((p) => ({
      slug: p.technologyB.slug,
      name: p.technologyB.name,
      repositoryCount: p.repositoryCount,
      strengthScore: p.strengthScore,
    })),
    ...tech.pairingsB.map((p) => ({
      slug: p.technologyA.slug,
      name: p.technologyA.name,
      repositoryCount: p.repositoryCount,
      strengthScore: p.strengthScore,
    })),
  ].sort((a, b) => b.strengthScore - a.strengthScore).slice(0, 10);

  const data = {
    technology: {
      slug: tech.slug,
      name: tech.name,
      category: tech.category,
      description: tech.description,
      repoCount: tech.repoCount,
      totalRepositories,
      trendScore: latestSnapshot?.trendScore ?? 0,
    },
    pairings,
    topRepositories: topRepositories.map((rt) => rt.repository),
    snapshots: tech.snapshotsA
      .reverse()
      .map((s) => ({ date: s.snapshotDate.toISOString().split("T")[0], adoptionCount: s.adoptionCount })),
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 py-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href="/trending" className="hover:text-foreground transition-colors">Trending</Link>
        <span>/</span>
        <span className="text-foreground">{data.technology.name}</span>
      </div>

      {/* 1. Header */}
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-5xl font-extrabold tracking-tight">{data.technology.name}</h1>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold border border-primary/20">
                {data.technology.category}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={`https://www.npmjs.com/package/${tech.npmPackage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                npm: {tech.npmPackage}
              </a>
            </div>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              {data.technology.description}
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
        technology={data.technology}
        pairings={data.pairings}
        topRepositories={data.topRepositories}
        snapshots={data.snapshots}
        totalRepositories={data.technology.totalRepositories}
      />
    </div>
  );
}