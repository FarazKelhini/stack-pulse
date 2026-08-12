import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const FallingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
  const rl = await rateLimit(ip);
  if (!rl.success) return rl.response;

  try {
    const { searchParams } = new URL(request.url);
    const result = FallingSchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400, headers: rl.headers });
    }

    const { limit } = result.data;

    // Find the most recent snapshot date
    const latestSnapshot = await prisma.trendingSnapshot.findFirst({
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true },
    });

    if (!latestSnapshot) {
      return NextResponse.json({ technologies: [], snapshotDate: null }, { headers: rl.headers });
    }

    const snapshots = await prisma.trendingSnapshot.findMany({
      where: {
        snapshotDate: latestSnapshot.snapshotDate,
        adoptionDelta: { lt: 0 },
        technology: { isActive: true },
      },
      include: {
        technology: {
          select: {
            slug: true,
            name: true,
            category: true,
            repoCount: true,
          },
        },
      },
      take: limit * 2, // Fetch extra so we can sort by percentChange correctly
    });

    const results = snapshots
      .map((s) => {
        const currentCount = s.technology.repoCount || s.adoptionCount;
        const previousCount = currentCount - s.adoptionDelta;
        const percentChange = previousCount > 0 ? (s.adoptionDelta / previousCount) * 100 : 0;
        return {
          slug: s.technology.slug,
          name: s.technology.name,
          category: s.technology.category,
          repoCount: s.technology.repoCount,
          adoptionDelta: s.adoptionDelta,
          percentChange: Number(percentChange.toFixed(1)),
        };
      })
      .sort((a, b) => a.percentChange - b.percentChange)
      .slice(0, limit);

    return NextResponse.json(
      {
        technologies: results,
        snapshotDate: latestSnapshot.snapshotDate.toISOString().split("T")[0],
      },
      { headers: rl.headers }
    );
  } catch (error) {
    logger.error({ error }, "Falling trending API error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: rl.headers });
  }
}
