import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
  const rl = await rateLimit(ip);
  if (!rl.success) return rl.response;

  try {
    const categories = await prisma.technology.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
    });

    const categoryList = categories.map((c) => c.category).sort((a, b) => a.localeCompare(b));
    const results = [];

    for (const category of categoryList) {
      const topTech = await prisma.technology.findFirst({
        where: { category, isActive: true },
        orderBy: { repoCount: "desc" },
        select: {
          slug: true,
          name: true,
          category: true,
          repoCount: true,
        },
      });

      if (topTech) {
        results.push(topTech);
      }
    }

    return NextResponse.json(
      { categories: results },
      { headers: rl.headers }
    );
  } catch (error) {
    logger.error({ error }, "Top Per Category API error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: rl.headers });
  }
}
