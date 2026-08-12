import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const WeeklyTrendingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
  const rl = await rateLimit(ip);
  if (!rl.success) return rl.response;

  try {
    const { searchParams } = new URL(request.url);
    const result = WeeklyTrendingSchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400, headers: rl.headers });
    }

    const { limit } = result.data;

    // Get today's date (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Find active technologies with today's snapshot where adoptionCount >= 10
    const technologiesWithTodaySnapshot = await prisma.trendingSnapshot.findMany({
      where: {
        snapshotDate: today,
        adoptionCount: { gte: 10 },
        technology: { isActive: true },
      },
      select: {
        technologyId: true,
        adoptionCount: true,
        technology: {
          select: {
            slug: true,
            name: true,
            category: true,
            repoCount: true,
          },
        },
      },
    });

    // If no technology has today's snapshot, fall back to most recent snapshot date with data
    if (technologiesWithTodaySnapshot.length === 0) {
      // Find the most recent snapshot date with at least one row where adoptionCount >= 10
      const latestSnapshotDate = await prisma.trendingSnapshot.findFirst({
        where: { adoptionCount: { gte: 10 } },
        orderBy: { snapshotDate: "desc" },
        select: { snapshotDate: true },
      });

      if (!latestSnapshotDate) {
        return NextResponse.json(
          { technologies: [], snapshotDate: null, comparisonDate: null },
          { headers: rl.headers }
        );
      }

      const fallbackDate = latestSnapshotDate.snapshotDate;
      const fallbackSevenDaysAgo = new Date(fallbackDate);
      fallbackSevenDaysAgo.setDate(fallbackDate.getDate() - 7);

      // Fetch technologies for the fallback snapshot date
      const fallbackSnapshot = await prisma.trendingSnapshot.findMany({
        where: {
          snapshotDate: fallbackDate,
          adoptionCount: { gte: 10 },
          technology: { isActive: true },
        },
        select: {
          technologyId: true,
          adoptionCount: true,
          technology: {
            select: {
              slug: true,
              name: true,
              category: true,
              repoCount: true,
            },
          },
        },
      });

      // Get all historical snapshots for comparison (bounded: only for the technologies we have)
      const techIds = fallbackSnapshot.map((s) => s.technologyId);
      const historicalSnapshots = await prisma.trendingSnapshot.findMany({
        where: {
          technologyId: { in: techIds },
          snapshotDate: { lte: fallbackDate },
        },
        orderBy: { snapshotDate: "asc" },
      });

      // Group historical snapshots by technologyId
      const historicalByTech = new Map<string, typeof historicalSnapshots>();
      for (const s of historicalSnapshots) {
        const list = historicalByTech.get(s.technologyId) ?? [];
        list.push(s);
        historicalByTech.set(s.technologyId, list);
      }

      const results: Array<{
        slug: string;
        name: string;
        category: string;
        repoCount: number;
        weeklyDelta: number;
        weeklyPercentChange: number | null;
      }> = [];

      for (const snap of fallbackSnapshot) {
        const history = historicalByTech.get(snap.technologyId) ?? [];
        // Find snapshot 7 days prior, or oldest available (matching trends.ts fallback pattern)
        const priorRows = history.filter(
          (s) => s.snapshotDate.getTime() <= fallbackSevenDaysAgo.getTime()
        );
        const priorSnap = priorRows.length > 0 ? priorRows[priorRows.length - 1] : history[0];

        const priorAdoption = priorSnap?.adoptionCount ?? 0;
        const weeklyDelta = snap.adoptionCount - priorAdoption;

        if (weeklyDelta <= 0) continue;

        const weeklyPercentChange =
          priorAdoption > 0
            ? Number(((weeklyDelta / priorAdoption) * 100).toFixed(1))
            : null;

        results.push({
          slug: snap.technology.slug,
          name: snap.technology.name,
          category: snap.technology.category,
          repoCount: snap.technology.repoCount,
          weeklyDelta,
          weeklyPercentChange,
        });
      }

      results.sort((a, b) => b.weeklyDelta - a.weeklyDelta);

      return NextResponse.json(
        {
          technologies: results.slice(0, limit),
          snapshotDate: fallbackDate.toISOString().split("T")[0],
          comparisonDate: fallbackSevenDaysAgo.toISOString().split("T")[0],
        },
        { headers: rl.headers }
      );
    }

    // Get technology IDs for bounded historical query
    const techIds = technologiesWithTodaySnapshot.map((s) => s.technologyId);

    // Fetch all historical snapshots for comparison (bounded: only for eligible technologies)
    // Fetch all history up to today to handle the fallback case (< 7 days of history)
    const historicalSnapshots = await prisma.trendingSnapshot.findMany({
      where: {
        technologyId: { in: techIds },
        snapshotDate: { lt: today },
      },
      orderBy: { snapshotDate: "asc" },
    });

    // Group historical snapshots by technologyId
    const historicalByTech = new Map<string, typeof historicalSnapshots>();
    for (const s of historicalSnapshots) {
      const list = historicalByTech.get(s.technologyId) ?? [];
      list.push(s);
      historicalByTech.set(s.technologyId, list);
    }

    const results: Array<{
      slug: string;
      name: string;
      category: string;
      repoCount: number;
      weeklyDelta: number;
      weeklyPercentChange: number | null;
    }> = [];

    for (const todaySnap of technologiesWithTodaySnapshot) {
      const history = historicalByTech.get(todaySnap.technologyId) ?? [];
      // Find snapshot 7 days prior, or oldest available (matching trends.ts fallback pattern)
      const priorRows = history.filter(
        (s) => s.snapshotDate.getTime() <= sevenDaysAgo.getTime()
      );
      const priorSnap = priorRows.length > 0 ? priorRows[priorRows.length - 1] : history[0];

      const priorAdoption = priorSnap?.adoptionCount ?? 0;
      const weeklyDelta = todaySnap.adoptionCount - priorAdoption;

      if (weeklyDelta <= 0) continue;

      const weeklyPercentChange =
        priorAdoption > 0
          ? Number(((weeklyDelta / priorAdoption) * 100).toFixed(1))
          : null;

      results.push({
        slug: todaySnap.technology.slug,
        name: todaySnap.technology.name,
        category: todaySnap.technology.category,
        repoCount: todaySnap.technology.repoCount,
        weeklyDelta,
        weeklyPercentChange,
      });
    }

    results.sort((a, b) => b.weeklyDelta - a.weeklyDelta);

    return NextResponse.json(
      {
        technologies: results.slice(0, limit),
        snapshotDate: today.toISOString().split("T")[0],
        comparisonDate: sevenDaysAgo.toISOString().split("T")[0],
      },
      { headers: rl.headers }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, service: "api" }, "Weekly trending API error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: rl.headers }
    );
  }
}
