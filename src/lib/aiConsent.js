// AI consent tracking — web equivalent of the iOS/Android consent sheets.
// Persists the user's opt-in to AI processing (OpenAI) in localStorage.
// Keys are versioned (v1) so we can prompt again later if scope changes.

const KEY_GRANTED = 'ai_consent_v1_granted';
const KEY_DATE = 'ai_consent_v1_date';

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasConsented() {
  const ls = safeStorage();
  if (!ls) return false;
  return ls.getItem(KEY_GRANTED) === 'true';
}

export function grant() {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(KEY_GRANTED, 'true');
    ls.setItem(KEY_DATE, new Date().toISOString());
  } catch { /* localStorage may be full or blocked */ }
}

export function revoke() {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(KEY_GRANTED, 'false');
    ls.removeItem(KEY_DATE);
  } catch { /* ignore */ }
}

export function consentDate() {
  const ls = safeStorage();
  if (!ls) return null;
  return ls.getItem(KEY_DATE);
}
