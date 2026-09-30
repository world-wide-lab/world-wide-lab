import { createCache, memoryStore } from "cache-manager";
import type { Request } from "express";

const cache = createCache(memoryStore(), {
  max: 50,
  ttl: 10 * 1000 /* milliseconds */,
});

function getCacheKey(req: Request): string {
  const query = req.query as Record<string, unknown>;
  const sortedQuery = Object.keys(query)
    .sort()
    .map((key) => [key, query[key]]);
  return `${req.path}${JSON.stringify(sortedQuery)}`;
}

export { cache, getCacheKey };
