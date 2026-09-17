import { createCache, memoryStore } from "cache-manager";
import type { Request } from "express";

const cache = createCache(memoryStore(), {
  max: 50,
  ttl: 10 * 1000 /* milliseconds */,
});

/**
 * Build a cache key for a request, based on its path and query parameters.
 *
 * Query parameters are included, since they usually change the result of a
 * request and would otherwise all share the same cache entry. They are sorted
 * by name, so that the order in which they are supplied does not matter.
 */
function getCacheKey(req: Request): string {
  const query = req.query as Record<string, unknown>;
  const sortedQuery = Object.keys(query)
    .sort()
    .map((key) => [key, query[key]]);
  return `${req.path}${JSON.stringify(sortedQuery)}`;
}

export { cache, getCacheKey };
