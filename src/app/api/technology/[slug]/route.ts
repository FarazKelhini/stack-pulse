import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const SlugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
  const rl = await rateLimit(ip);
  if (!rl.success) return rl.response;

  try {
    const { slug } = await params;
    const result = SlugSchema.safeParse({ slug });

    if (!result.success) {
      return NextResponse.json({ error: "Invalid slug format" }, { status: 400, headers: rl.headers });
    }

    const tech = await prisma.technology.findUnique({
      where: { slug: result.data.slug },
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
      return NextResponse.json({ error: "Technology not found" }, { status: 404, headers: rl.headers });
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

    return NextResponse.json(
      {
        technology: {
          slug: tech.slug,
          name: tech.name,
          category: tech.category,
          description: tech.description,
          repoCount: tech.repoCount,
          totalRepositories,
          trendScore: latestSnapshot?.trendScore ?? 0,
        },
        totalRepositories,
        pairings,
        topRepositories: topRepositories.map((rt) => rt.repository),
        snapshots: tech.snapshotsA
          .reverse()
          .map((s) => ({ date: s.snapshotDate.toISOString().split("T")[0], adoptionCount: s.adoptionCount })),
      },
      { headers: rl.headers }
    );
  } catch (error) {
    logger.error({ error }, "Technology API error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: rl.headers });
  }
}
