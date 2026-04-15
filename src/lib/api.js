const API = import.meta.env.REACT_APP_BACKEND_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // Handle Pydantic validation errors (array of error objects)
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
