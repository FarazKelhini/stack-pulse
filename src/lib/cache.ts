import { redis } from "./redis";

export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      console.log(`Cache hit for key: ${key}`);
      return cached;
    }
  } catch (e) {
    console.error(`Redis cache error for key ${key}:`, e);
  }

  console.log(`Cache miss for key: ${key}`);
  const data = await fetchFn();

  try {
    await redis.set(key, data, { ex: ttlSeconds });
  } catch (e) {
    console.error(`Failed to set Redis cache for key ${key}:`, e);
  }

  return data;
}
