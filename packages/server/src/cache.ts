import { createCache, memoryStore } from "cache-manager";

const cache = createCache(memoryStore(), {
  max: 50,
  ttl: 10 * 1000 /* milliseconds */,
});

export { cache };
