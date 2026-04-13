function asString(value = "") {
  return String(value || "").trim();
}

export const AUTH_STATES = {
  UNKNOWN: "unknown",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
  REFRESHING: "refreshing",
  ERROR: "error",
};

export function normalizeAuthUser(user = {}) {
  return {
    id: asString(user.id),
    email: asString(user.email).toLowerCase(),
    name: asString(user.name || user.fullName || user.displayName),
    avatarUrl: asString(user.avatarUrl || user.avatar_url),
    provider: asString(user.provider || "email"),
    createdAt: asString(user.createdAt || user.created_at),
    updatedAt: asString(user.updatedAt || user.updated_at),
  };
}

export function normalizeSession(session = {}) {
  return {
    accessToken: asString(session.accessToken || session.access_token),
    refreshToken: asString(session.refreshToken || session.refresh_token),
    tokenType: asString(session.tokenType || session.token_type || "bearer").toLowerCase(),
    expiresAt: asString(session.expiresAt || session.expires_at),
    expiresIn: Number(session.expiresIn || session.expires_in || 0) || 0,
    state: asString(session.state || AUTH_STATES.UNKNOWN),
  };
}

export function sessionExpiryMs(session = {}) {
  const normalized = normalizeSession(session);
  const byDate = Date.parse(normalized.expiresAt || "");
  if (Number.isFinite(byDate)) return byDate;
  if (normalized.expiresIn > 0) return Date.now() + normalized.expiresIn * 1000;
  return 0;
}

export function hasValidSession(session = {}, nowMs = Date.now(), skewMs = 60_000) {
  const normalized = normalizeSession(session);
  if (!normalized.accessToken) return false;
  const exp = sessionExpiryMs(normalized);
  if (!exp) return true;
  return exp - nowMs > Math.max(0, Number(skewMs) || 0);
}

export function authStateFromSession(session = {}) {
  return hasValidSession(session) ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.UNAUTHENTICATED;
}

export function canAccessOwner(user = {}, ownerEmail = "") {
  const normalized = normalizeAuthUser(user);
  const owner = asString(ownerEmail).toLowerCase();
  if (!owner) return Boolean(normalized.id);
  return normalized.email === owner;
}

export function assertAuthenticatedContext({ user = {}, session = {} } = {}) {
  const normalizedUser = normalizeAuthUser(user);
  if (!normalizedUser.id) {
    throw new Error("Missing authenticated user id");
  }
  if (!hasValidSession(session)) {
    throw new Error("Missing or expired session");
  }
  return { user: normalizedUser, session: normalizeSession(session) };
}
