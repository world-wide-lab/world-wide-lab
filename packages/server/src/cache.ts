import { createCache } from "cache-manager";
import { CacheableMemory } from "cacheable";
import Keyv from "keyv";

const TTL = 10 * 1000; /* milliseconds */

const cache = createCache({
  // The in-memory store is wrapped by hand rather than left to the default, so
  // that the number of entries stays bounded
  stores: [new Keyv({ store: new CacheableMemory({ ttl: TTL, lruSize: 50 }) })],
  ttl: TTL,
});

export { cache };
