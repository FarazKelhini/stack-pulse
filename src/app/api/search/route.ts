import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const SearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
}).refine(data => data.q || data.category, {
  message: "Either q or category must be provided",
  path: ["q"],
});

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
  const rl = await rateLimit(ip);
  if (!rl.success) return rl.response;

  try {
    const { searchParams } = new URL(request.url);
    const result = SearchSchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return NextResponse.json({ error: "Invalid query parameter" }, { status: 400, headers: rl.headers });
    }

    const { q, category } = result.data;

    const where: any = {
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (q) {
      where.OR = [
        { slug: { startsWith: q, mode: "insensitive" } },
        { name: { startsWith: q, mode: "insensitive" } },
      ];
    }

    const technologies = await prisma.technology.findMany({
      where,
      orderBy: { repoCount: "desc" },
      take: 20,
      select: {
        slug: true,
        name: true,
        category: true,
        repoCount: true,
        description: true,
      },
    });

    return NextResponse.json({ results: technologies }, { headers: rl.headers });
  } catch (error) {
    logger.error({ error }, "Search API error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: rl.headers });
  }
}
