/**
 * Simple in-memory cache for API responses.
 * Shows stale data instantly, refreshes in background.
 */
const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.data;
}

export function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export function clearCache(keyPrefix) {
  if (!keyPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) cache.delete(key);
  }
}
