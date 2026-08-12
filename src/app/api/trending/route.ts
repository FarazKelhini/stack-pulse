import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const TrendingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
  const rl = await rateLimit(ip);
  if (!rl.success) return rl.response;

  try {
    const { searchParams } = new URL(request.url);
    const result = TrendingSchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400, headers: rl.headers });
    }

    const { limit } = result.data;

    // Find the most recent snapshot date with at least one trendScore > 0
    const latestSnapshot = await prisma.trendingSnapshot.findFirst({
      where: { trendScore: { gt: 0 } },
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true },
    });

    if (!latestSnapshot) {
      return NextResponse.json({ technologies: [], snapshotDate: null }, { headers: rl.headers });
    }

    const technologies = await prisma.trendingSnapshot.findMany({
      where: {
        snapshotDate: latestSnapshot.snapshotDate,
        trendScore: { gt: 0 },
        technology: { isActive: true },
      },
      orderBy: { trendScore: "desc" },
      take: limit,
      select: {
        technology: {
          select: {
            slug: true,
            name: true,
            category: true,
            repoCount: true,
          },
        },
        trendScore: true,
      },
    });

    return NextResponse.json(
      {
        technologies: technologies.map((t) => ({
          ...t.technology,
          trendScore: t.trendScore,
        })),
        snapshotDate: latestSnapshot.snapshotDate.toISOString().split("T")[0],
      },
      { headers: rl.headers }
    );
  } catch (error) {
    logger.error({ error }, "Trending API error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: rl.headers });
  }
}
