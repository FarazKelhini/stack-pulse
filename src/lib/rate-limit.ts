import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

// If env is unset, no-op pass-through
const ratelimit =
  KV_REST_API_URL && KV_REST_API_TOKEN
    ? new Ratelimit({
        redis: new Redis({
          url: KV_REST_API_URL,
          token: KV_REST_API_TOKEN,
        }),
        limiter: Ratelimit.slidingWindow(60, "60 s"),
      })
    : null;

export async function rateLimit(ip: string) {
  if (!ratelimit) {
    return { success: true, headers: {} };
  }

  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  const headers = {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": reset.toString(),
  };

  if (!success) {
    const retryAfter = Math.ceil((reset * 1000 - Date.now()) / 1000);
    return {
      success: false,
      headers,
      response: NextResponse.json(
        { error: "Too many requests. Please retry after 60 seconds." },
        { status: 429, headers: { ...headers, "Retry-After": retryAfter.toString() } }
      ),
    };
  }

  return { success: true, headers };
}
