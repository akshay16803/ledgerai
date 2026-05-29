# PostHog Anonymous Analytics — Setup Guide

This document gets PostHog live on iOS + Android in **anonymous mode**.

## What this gives you

- **Daily / Weekly / Monthly Active Users** per platform
- **Most-viewed screens** ranked, with view counts and time spent
- **Most-tapped buttons** ranked, with tap counts
- **Retention cohorts** — are people coming back day 1, 7, 30?
- **Funnels** — e.g., Login → Add first transaction → Subscribe
- **Per-device session timelines** — every screen viewed, every button tapped, in chronological order, for a single anonymous device UUID

## What this deliberately does NOT do

- Never links events to a SpentyAI user_id, email, or name
- Never creates an "identified person" in PostHog
- Never records the actual screen contents (session replay is off)
- Every install gets a random device UUID; that UUID is the only key

The Swift and Kotlin `Analytics.identify(...)` methods are **no-ops by design**. Even if a future call site mistakenly calls them, no PII reaches PostHog.

---

## One-time setup — 5 minutes

### 1. Create a PostHog project

1. Go to https://posthog.com → **Sign up for free**. The free tier covers 1 million events/month.
2. Create a new project. Pick the US or EU cloud (US default; EU is `https://eu.i.posthog.com`).
3. From **Project Settings**, copy the **Project API Key** (starts with `phc_`).

### 2. Paste the key into the iOS app

1. Open `ios/SpentyAI/SpentyAI/SpentyAI.xcodeproj` in Xcode.
2. **File → Add Package Dependencies…**
   - URL: `https://github.com/PostHog/posthog-ios`
   - Version: **Up to Next Major Version** from `3.0.0`.
   - Add the `PostHog` library product to the `SpentyAI` target.
3. Open the `SpentyAI` target → **Info** tab → add two custom iOS Target Properties:
   - `POSTHOG_KEY` (String) = `phc_<your key>`
   - `POSTHOG_HOST` (String) = `https://us.i.posthog.com` (or `https://eu.i.posthog.com`)
4. Build + run. Watch the Xcode console for `[Analytics] PostHog active (anonymous, recordings off)`.

### 3. Paste the key into the Android app

1. Open `android-native/local.properties` (create the file if it doesn't exist).
2. Add two lines:
   ```
   posthog.key=phc_<your key>
   posthog.host=https://us.i.posthog.com
   ```
3. Build + run. Watch Logcat for `Analytics: PostHog active (anonymous, recordings off)`.

**Note:** `local.properties` is git-ignored — the key never lands in the repo.

---

## What is already instrumented

### iOS (15 screens + tab tracking)

Tab changes in `MainTabView` fire `screen_viewed` for: Dashboard, Transactions, Accounts, Reports, More.

Sub-screens with `.trackScreen(...)`: Dashboard, TransactionList, InvoiceList, PurchaseList, AIChat, Login, Billing, EmailSync, Settings, PremiumFeatureSheet, CashFlow, Reports, AccountList, Reconciliation, Records.

### Android (route-level + lifecycle)

Every route change in `AppNavigation.NavHost` fires `screen_viewed` with the route name (arguments stripped). Lifecycle events (app opened, foregrounded, backgrounded) are auto-captured by the PostHog SDK.

---

## Adding more events later

### iOS — track a screen
```swift
SomeView()
    .trackScreen("MyScreen")
```

### iOS — track a button
```swift
Button("Add Transaction") {
    Analytics.shared.buttonTapped("add_transaction")
}
```

### Android — track a screen (any composable)
```kotlin
LaunchedEffect(Unit) {
    Analytics.viewedScreen("MyScreen")
}
```

### Android — track a button
```kotlin
Button(onClick = {
    Analytics.buttonTapped("add_transaction")
}) { Text("Add") }
```

---

## Where to find your data in PostHog

Once events flow (usually within ~60 seconds of the first build):

- **Activity** → live event stream
- **Insights → Trends** → most-viewed screens, button-tap leaderboards (group events by `screen` or `button` property)
- **Insights → Funnels** → conversion funnels
- **Insights → Retention** → cohort retention by week
- **Persons** → list of anonymous devices (each with a UUID, no email/name)

---

## Verification checklist

After both platforms are deployed:

- [ ] Open the iOS app — see the launch event in PostHog Activity within ~1 min
- [ ] Switch tabs — see one `screen_viewed` event per tab
- [ ] Open the Android app — same
- [ ] Navigate between screens on Android — see `screen_viewed` per route
- [ ] Sign out + sign back in — should see two separate anonymous distinct_ids on the Persons page (sign-out triggers `reset()`)

If you don't see events:

1. Verify the API key was pasted correctly (no whitespace)
2. Verify the host matches your PostHog region
3. Check the device console (Xcode for iOS, Logcat for Android) for the `[Analytics]` log line

---

## Future ideas (not done yet)

- Add `Analytics.shared.buttonTapped(...)` on key buttons: Add Transaction, Subscribe (per plan), Sign in with Google/Apple, Connect Gmail, AI Send.
- Wire `signedIn(method:)` in `AuthViewModel` after a successful sign-in (no PII — just the method name).
- Add `premiumSheetShown(feature:)` when the premium gate is shown.

These can be added incrementally — every helper already exists on the Analytics facade; just sprinkle the call sites.
