const API = import.meta.env.REACT_APP_BACKEND_URL || '';

// Deduplication: prevent identical mutation requests within a short window
const inflight = new Map();

// GET response cache — keeps recently fetched reads in memory so navigating
// back to a page within the TTL window paints instantly. Mutations
// automatically bust cache entries whose path shares the same top-level
// /api/<resource> prefix so the next read is always fresh.
const GET_CACHE_TTL_MS = 15000;
const getCache = new Map();       // key -> { data, ts }
const getInflight = new Map();    // key -> Promise (coalesce concurrent identical GETs)

function resourcePrefix(path) {
  // "/api/mandates/abc" -> "/api/mandates"
  const m = path.match(/^(\/api\/[^/?#]+)/);
  return m ? m[1] : path.split('?')[0];
}

function invalidatePrefix(prefix) {
  for (const key of getCache.keys()) {
    if (key.startsWith(prefix)) getCache.delete(key);
  }
}

async function request(path, options = {}) {
  const method = options.method || 'GET';

  if (method === 'GET') {
    const key = path;
    if (options.bypassCache) {
      getCache.delete(key);
    }
    const cached = getCache.get(key);
    if (cached && Date.now() - cached.ts < GET_CACHE_TTL_MS) {
      return cached.data;
    }
    if (getInflight.has(key)) {
      return getInflight.get(key);
    }
    const promise = doFetch(path, options).then((data) => {
      getCache.set(key, { data, ts: Date.now() });
      return data;
    }).finally(() => {
      getInflight.delete(key);
    });
    getInflight.set(key, promise);
    return promise;
  }

  // Mutations: dedupe identical in-flight requests within a short window,
  // then bust the matching resource prefix from the GET cache.
  //
  // IMPORTANT: on failure, evict the inflight entry IMMEDIATELY. If we
  // kept a rejected promise in the map for 500 ms, the user's retry with
  // the same body would receive the stale rejection without a new network
  // call — and because `setError` would be called with the identical
  // error string, React would bail on re-render. Visible symptom: the
  // form looks frozen after the first failure (e.g., duplicate-name 400
  // on "Save Account"). Success path still waits 500 ms to absorb genuine
  // double-click storms.
  const key = `${method}:${path}:${options.body || ''}`;
  if (inflight.has(key)) {
    return inflight.get(key);
  }
  const promise = doFetch(path, options).then((data) => {
    invalidatePrefix(resourcePrefix(path));
    return data;
  });
  inflight.set(key, promise);
  promise.then(
    () => { setTimeout(() => inflight.delete(key), 500); },
    () => { inflight.delete(key); },
  );
  return promise;
}

async function doFetch(path, options) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    // 402 Payment Required → backend's require_active_subscription gate
    // fired. Bounce the user to /billing so they can subscribe / renew,
    // unless they're already there. Avoid an infinite redirect loop.
    if (res.status === 402 && typeof window !== 'undefined') {
      const onBilling = window.location.pathname.startsWith('/billing')
        || window.location.pathname.startsWith('/pricing')
        || window.location.pathname.startsWith('/payment-');
      if (!onBilling) {
        window.location.assign('/billing?expired=1');
      }
    }
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    let errorMessage = 'Request failed';
    if (Array.isArray(err.detail)) {
      errorMessage = err.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
    } else if (typeof err.detail === 'string') {
      errorMessage = err.detail;
    } else if (err.detail && typeof err.detail === 'object' && err.detail.message) {
      // 402 returns { detail: { error, message, ... } }
      errorMessage = err.detail.message;
    } else if (err.message) {
      errorMessage = err.message;
    }
    const e = new Error(errorMessage);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

export const api = {
  get: (path, opts) => request(path, { ...(opts || {}) }),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  del: (path) => request(path, { method: 'DELETE' }),
  // Manual cache bust — useful after a background action (upload, OAuth return, etc.)
  invalidate: (pathOrPrefix) => invalidatePrefix(pathOrPrefix),
  // Upload a file via FormData — bypasses the JSON Content-Type header
  upload: async (path, formData) => {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      let errorMessage = 'Upload failed';
      if (typeof err.detail === 'string') errorMessage = err.detail;
      else if (err.message) errorMessage = err.message;
      throw new Error(errorMessage);
    }
    invalidatePrefix(resourcePrefix(path));
    return res.json();
  },
};
