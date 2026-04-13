import * as SecureStore from "expo-secure-store";

export type ProviderSessionRecord = {
  provider: "google" | "microsoft";
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  issuedAt: number;
  tokenType: string;
  scope: string;
  idToken: string;
  email: string;
  providerClientId: string;
  msAccountId: string;
  msUsername: string;
  updatedAt: string;
};

const KEY_PREFIX = "ledgerai-mobile-provider:";

function sessionKey(userId: string, connectorId: string) {
  return `${KEY_PREFIX}${String(userId || "").trim()}:${String(connectorId || "").trim()}`;
}

export async function loadProviderSession(userId: string, connectorId: string): Promise<ProviderSessionRecord | null> {
  if (!userId || !connectorId) return null;
  try {
    const raw = await SecureStore.getItemAsync(sessionKey(userId, connectorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProviderSessionRecord;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveProviderSession(userId: string, connectorId: string, session: ProviderSessionRecord): Promise<void> {
  if (!userId || !connectorId) return;
  await SecureStore.setItemAsync(sessionKey(userId, connectorId), JSON.stringify(session));
}

export async function clearProviderSession(userId: string, connectorId: string): Promise<void> {
  if (!userId || !connectorId) return;
  await SecureStore.deleteItemAsync(sessionKey(userId, connectorId));
}
