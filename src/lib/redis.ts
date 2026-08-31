import { Redis } from "@upstash/redis";

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
  throw new Error("Redis environment variables are not set");
}

export const redis = new Redis({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
});
