const API = import.meta.env.REACT_APP_BACKEND_URL || '';

// Deduplication: prevent identical mutation requests within a short window
const inflight = new Map();

async function request(path, options = {}) {
  const method = options.method || 'GET';

  // For mutations (POST/PUT/DELETE), deduplicate within 2s window
  if (method !== 'GET') {
    const key = `${method}:${path}:${options.body || ''}`;
    if (inflight.has(key)) {
      return inflight.get(key); // Return the same in-flight promise
    }
    const promise = doFetch(path, options);
    inflight.set(key, promise);
    promise.finally(() => {
      setTimeout(() => inflight.delete(key), 500);
    });
    return promise;
  }

  return doFetch(path, options);
}

async function doFetch(path, options) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    let errorMessage = 'Request failed';
    if (Array.isArray(err.detail)) {
      errorMessage = err.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
    } else if (typeof err.detail === 'string') {
      errorMessage = err.detail;
    } else if (err.message) {
      errorMessage = err.message;
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  del: (path) => request(path, { method: 'DELETE' }),
};
