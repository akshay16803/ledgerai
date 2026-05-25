/**
 * Web analytics wrapper. Provides a single .track(name, props) entry
 * point that fans out to PostHog + Sentry breadcrumb + Clarity tag.
 * Every call is try/catch'd so a missing SDK NEVER breaks the UI.
 *
 * The SDKs themselves are loaded in index.html (see <script> blocks).
 * If the env vars are unset, the SDKs never load and these wrappers
 * become silent no-ops.
 */

function isReady(globalKey) {
  return typeof window !== "undefined" && typeof window[globalKey] === "function";
}

export function identify(userId, traits = {}) {
  try { if (window.posthog) window.posthog.identify(userId, traits); } catch {}
  try { if (window.clarity) window.clarity("identify", userId); } catch {}
  try { if (window.Sentry) window.Sentry.setUser({ id: userId, email: traits.email }); } catch {}
}

export function reset() {
  try { if (window.posthog && window.posthog.reset) window.posthog.reset(); } catch {}
  try { if (window.Sentry) window.Sentry.setUser(null); } catch {}
}

/**
 * Generic event tracker. Use snake_case event names so dashboards
 * group cleanly across web + mobile (mobile helpers use the same names).
 */
export function track(eventName, properties = {}) {
  try { if (window.posthog) window.posthog.capture(eventName, properties); } catch {}
  try { if (window.clarity) window.clarity("event", eventName); } catch {}
  try {
    if (window.Sentry && window.Sentry.addBreadcrumb) {
      window.Sentry.addBreadcrumb({ category: "ux", message: eventName, data: properties, level: "info" });
    }
  } catch {}
}

/** Special-purpose helpers for the events we care about most. */
export const Events = {
  signedIn:           (method)                  => track("signed_in", { method }),
  signedOut:          ()                        => track("signed_out"),
  viewedPage:         (path)                    => track("page_viewed", { path }),
  premiumSheetShown:  (feature)                 => track("premium_sheet_shown", { feature }),
  premiumSheetTap:    (feature, action)         => track("premium_sheet_tap", { feature, action }),
  subscribeTapped:    (plan)                    => track("subscribe_tapped", { plan }),
  subscribeSuccess:   (plan, amount, provider)  => track("subscribe_success", { plan, amount, provider }),
  subscribeFailed:    (plan, error)             => track("subscribe_failed", { plan, error }),
  emailSyncConnected: (provider)                => track("email_sync_connected", { provider }),
  smsSyncStarted:     ()                        => track("sms_sync_started"),
  aiChatMessageSent:  ()                        => track("ai_chat_message_sent"),
};

export default { identify, reset, track, Events };
