import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import { Platform } from "react-native";

const APP_SCHEME = "ledgerai";
const APP_APPLICATION_ID = "com.ledgerai.mobile";
const DEFAULT_MS_TENANT = "consumers";

type ProviderRuntimeConfig = {
  googleIosClientId: string;
  googleAndroidClientId: string;
  microsoftClientId: string;
  microsoftTenant: string;
};

function readExtra() {
  const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;
  return {
    googleIosClientId: String(extra.googleIosClientId || "").trim(),
    googleAndroidClientId: String(extra.googleAndroidClientId || "").trim(),
    microsoftClientId: String(extra.microsoftClientId || "").trim(),
    microsoftTenant: String(extra.microsoftTenant || "").trim(),
  };
}

function readRuntimeConfig(): ProviderRuntimeConfig {
  const extra = readExtra();
  return {
    googleIosClientId: String(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || extra.googleIosClientId || "").trim(),
    googleAndroidClientId: String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || extra.googleAndroidClientId || "").trim(),
    microsoftClientId: String(process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || extra.microsoftClientId || "").trim(),
    microsoftTenant: String(process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || extra.microsoftTenant || DEFAULT_MS_TENANT).trim() || DEFAULT_MS_TENANT,
  };
}

export function getProviderRuntimeConfig() {
  const cfg = readRuntimeConfig();
  const googleClientId = Platform.select({
    ios: cfg.googleIosClientId,
    android: cfg.googleAndroidClientId,
    default: "",
  }) || "";

  return {
    appScheme: APP_SCHEME,
    appApplicationId: APP_APPLICATION_ID,
    google: {
      clientId: googleClientId,
      iosClientId: cfg.googleIosClientId,
      androidClientId: cfg.googleAndroidClientId,
      available: Boolean(googleClientId),
      blockers: googleClientId
        ? []
        : [Platform.OS === "ios" ? "Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID" : "Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"],
      redirectUri: AuthSession.makeRedirectUri({
        native: `${APP_APPLICATION_ID}:/oauthredirect`,
      }),
    },
    microsoft: {
      clientId: cfg.microsoftClientId,
      tenant: cfg.microsoftTenant,
      available: Boolean(cfg.microsoftClientId),
      blockers: cfg.microsoftClientId ? [] : ["Set EXPO_PUBLIC_MICROSOFT_CLIENT_ID"],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: APP_SCHEME,
        path: "auth/provider-callback/microsoft",
      }),
      issuer: `https://login.microsoftonline.com/${cfg.microsoftTenant}/v2.0`,
    },
    recoveryRedirectUri: AuthSession.makeRedirectUri({
      scheme: APP_SCHEME,
      path: "auth/recovery",
    }),
  };
}
