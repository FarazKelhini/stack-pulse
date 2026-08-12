import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const PairingsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
  const rl = await rateLimit(ip);
  if (!rl.success) return rl.response;

  try {
    const { searchParams } = new URL(request.url);
    const result = PairingsSchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400, headers: rl.headers });
    }

    const { limit } = result.data;

    const pairings = await prisma.technologyPairing.findMany({
      take: limit,
      orderBy: { strengthScore: "desc" },
      include: {
        technologyA: {
          select: {
            slug: true,
            name: true,
          },
        },
        technologyB: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });

    const results = pairings.map((p) => ({
      techA: p.technologyA.name,
      slugA: p.technologyA.slug,
      techB: p.technologyB.name,
      slugB: p.technologyB.slug,
      strengthScore: Number(p.strengthScore.toFixed(2)),
      repositoryCount: p.repositoryCount,
    }));

    return NextResponse.json(
      { pairings: results },
      { headers: rl.headers }
    );
  } catch (error) {
    logger.error({ error }, "Top Pairings API error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: rl.headers });
  }
}
