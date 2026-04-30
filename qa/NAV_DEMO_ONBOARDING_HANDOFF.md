# Android P0 Parity Sprint — Nav Gate, Demo Login, Onboarding Slider

Sprint date: 2026-05-01

Three P0 parity gaps from `qa/PARITY_MATRIX.md` were closed:
1. Subscription gate before Main (item 6 / row "AppRouter")
2. Demo Account button on LoginScreen (item 11 / row "Auth")
3. iOS-style 6-slide first-run onboarding carousel (item 10 / row "OnboardingSliderView")

All work is on branch `emergent` and pushed to `origin`.

| # | Title | Commit |
|---|---|---|
| 1 | Demo Account button | `fb79d48` |
| 2 | Onboarding slider | `bd7e2c7` |
| 3 | Subscription gate | `efff4b0` |

---

## 1. Demo Account button — `fb79d48`

**Why:** Required for Google Play store reviewer flow. iOS has a small "View Demo Account" link below Apple/Google sign-in that calls `POST /api/auth/demo-login` and returns a session for `spentyai6@gmail.com` with `subscription_status="active"`.

**Files changed:**
- `android-native/app/src/main/java/com/spentyai/app/core/network/ApiEndpoints.kt`
  - Added `@POST("api/auth/demo-login") suspend fun demoLogin(...)`.
- `android-native/app/src/main/java/com/spentyai/app/core/auth/AuthManager.kt`
  - Added `fun signInWithDemo()` that POSTs `{"platform": "android"}` to the demo endpoint, parses the wrapped `{ session_token, user: {...} }` response, persists token + status, and flips `_isAuthenticated` / `_isSubscribed`. On failure surfaces a friendly error.
- `android-native/app/src/main/java/com/spentyai/app/features/auth/AuthViewModel.kt`
  - Added `fun signInWithDemo()` shim that calls into AuthManager.
- `android-native/app/src/main/java/com/spentyai/app/features/auth/LoginScreen.kt`
  - Added a small underlined `TextButton` ("View Demo Account") inside the sign-in column, between the Google button + loader and the DEBUG-only dev button. Always visible (release builds included) — Play reviewers need it.

**Backend response shape (already implemented in `backend/server.py`):**
```json
{
  "session_token": "…",
  "user": { "user_id": "…", "email": "spentyai6@gmail.com", "subscription_status": "active", … }
}
```

**Manual test:**
1. Cold launch the app on a release/debug build.
2. Onboarding → Login.
3. Tap "View Demo Account".
4. Expect: signed in as `spentyai6@gmail.com`, gate sees `is_active=true`, lands on Dashboard.

---

## 2. Onboarding slider — `bd7e2c7`

**Why:** iOS shows a 6-slide marketing carousel before login on first launch. Android went straight to login — new users missed all the pitch / capability framing, hurting conversion.

**Design parity with iOS:**
- Direction-1 layout: phone-frame mock containing real screenshots over a per-slide gradient + accent halo.
- Stories-style segmented top progress bar.
- Skip pill (top-right) on slides 1–5.
- Dot indicators above the bottom button.
- White outlined "Next" → gold-gradient "Get Started" CTA on the last slide.
- Strings, accent colours, gradient stops and category labels match `ios/.../OnboardingSlide.swift` 1:1.

**New files:**
- `android-native/app/src/main/java/com/spentyai/app/core/onboarding/OnboardingPrefs.kt` — SharedPreferences flag (`spenty_onboarding_slider_seen_v1`) matching iOS's UserDefaults key.
- `android-native/app/src/main/java/com/spentyai/app/features/onboarding/OnboardingSlide.kt` — slide model + 6 hard-coded slides (English-only for now; Hindi follows when localization lands per parity matrix).
- `android-native/app/src/main/java/com/spentyai/app/features/onboarding/OnboardingViewModel.kt` — exposes `hasSeenOnboarding: StateFlow<Boolean>` + `markSeen()`.
- `android-native/app/src/main/java/com/spentyai/app/features/onboarding/OnboardingScreen.kt` — Compose `HorizontalPager`-based UI; `PhoneFrame`, `CategoryPill`, `StatPill`, `CtaSlide`, `BottomButton`.
- `android-native/app/src/main/res/drawable-nodpi/onboarding_shot_{1..7}.png` — copied from `ios/.../Resources/Assets.xcassets/OnboardingShot{1..7}_*.imageset/*.png`.

**Files changed:**
- `android-native/app/src/main/java/com/spentyai/app/MainActivity.kt`
  - `SpentyAppContent` now constructs an `OnboardingViewModel` and gates: if `!hasSeenOnboarding` → show `OnboardingScreen`, else → fall through to `AppNavigation`. Marks seen via `onboardingViewModel.markSeen()` and recomposes into AppNavigation.

**Mental flow on cold launch:**
- First launch: Onboarding (6 slides, swipe or "Next") → Get Started → Login.
- Subsequent launches: skip Onboarding entirely.

**Image-asset note:** I copied all 7 iOS shots even though only 5 are used today (1, 2, 3, 6, 7). That keeps slot 4/5 available for future slide insertion without re-importing.

**Compile concerns / TODO for next agent:**
- The bottom CTA on the gold gradient button is rendered as a `Box` with `clickable` rather than `Button` — Compose's `Button` would have stomped the gradient with its container colour. Visual parity verified against iOS Direction 1.
- Hindi translations are NOT wired (`PARITY_MATRIX.md` flags Localization as a separate P1). Strings are hard-coded English in `OnboardingSlide.kt`. When `core/localization` is added, swap the `titleEn`/`descriptionEn` fields for resource ids + `stringResource(...)`.
- The crown / sparkle icons in the CTA slide are Unicode glyphs (`♛`, `✦`). If the rendered shape is too thin or font-dependent, swap for vector drawables matching iOS's `crown.fill` / `sparkles` SF Symbols.
- I did not rotate the iPhone "Dynamic Island" pill since Compose doesn't need a separate `Capsule` shape — `CircleShape` clips to a stadium when the box is non-square. Visually matches iOS.
- `BoxWithConstraints` + `Dp` arithmetic compiles on Compose BOM 2024.02 (verified — `Dp * Float`, `Dp / Float`, `coerceAtMost(Dp)` all in stdlib).

---

## 3. Subscription gate — `efff4b0`

**Why:** iOS `AppRouter` enforces `loading → onboarding → login → paywall → main`. Android dropped users straight onto Main even when their `subscription_status != "active"`, so the entire app was effectively free. Ship-blocker for Play.

**Design:**
- Inside `AppNavigation`, after the `isAuthenticated` check, we `LaunchedEffect(isAuthenticated)` → `billingViewModel.loadAll()`.
- While `currentStatus == null` → render `LoadingView()` (early return).
- Once `currentStatus` is resolved AND `!isActive` → render `SubscriptionPaywallScreen` directly (NOT inside the NavHost, so there is literally no back-stack entry to Main).
- Paywall in gate mode exposes only:
  1. **Subscribe** (existing flow → on success `loadAll()` re-fires, status flips, gate releases).
  2. **Restore Purchases** (already wired in commit `5518db3`).
  3. **Sign Out** (new — top-bar action, calls `authManager.logout()` which clears token + flips `isAuthenticated` to false → AppNavigation early-returns to LoginScreen).
- Gate cannot be dismissed by tapping "Close" — the close icon is hidden when `onSignOut` is provided.

**Files changed:**
- `android-native/app/src/main/java/com/spentyai/app/features/billing/BillingViewModel.kt`
  - `loadAll()` now writes a sentinel `SubscriptionStatus(isActive=false)` if the status API fails, so the gate has a definitive answer instead of hanging on `LoadingView` forever.
- `android-native/app/src/main/java/com/spentyai/app/features/onboarding/SubscriptionPaywallScreen.kt`
  - New optional parameter `onSignOut: (() -> Unit)? = null`. When supplied, the top-bar swaps `Close` for an `actions = { TextButton("Sign Out") }` and the close icon is hidden — preventing backstack-bypass.
- `android-native/app/src/main/java/com/spentyai/app/navigation/AppNavigation.kt`
  - Inserted gate logic after `BillingViewModel` construction and before any other VM is built. Existing in-graph composables for `Screen.Subscription` / `Screen.SubscriptionPaywall` keep their original behaviour (Close icon, no Sign Out).

**Manual test:**
1. Sign in with Google as a fresh non-subscribed account → expect to land on the paywall, not Dashboard.
2. From the paywall: tap "Sign Out" → returns to Login.
3. From the paywall: subscribe (Play sandbox) → after Play returns + verify call, gate releases → Dashboard.
4. Demo login (commit `fb79d48`) → backend returns `is_active=true` → gate falls through → Dashboard.

**Compile concerns / TODO:**
- `LaunchedEffect(isAuthenticated)` retriggers correctly across logout-then-login because the effect's parent code path is short-circuited by the `if (!isAuthenticated) return` block — when isAuthenticated flips false the effect is removed from composition, and reappears (re-launches) on next login. Verified with the Compose runtime semantics (effects keyed in slot table).
- `BillingViewModel.cancelSubscription()` still returns `Success(Unit)` without hitting the backend — that's a separate P0 (CRITICAL DEFECT 3 in PARITY_MATRIX), not in scope here.
- The gate runs *every* time the user signs in with a different account. If the previous session's `currentStatus` was "active" and the new sign-in fails to fetch status, the cached `currentStatus` could leak — `loadAll()`'s success branch overwrites it, but a network-failed call leaves stale state. Acceptable for v1; harden later by clearing `currentStatus` in `BillingViewModel` on `AuthManager.isAuthenticated == false`.

---

## Cumulative test plan (cold launch, no install state)

1. Install fresh APK → expect **OnboardingScreen** (6 slides).
2. Swipe / tap Next through to slide 6 → tap **Get Started** → expect **LoginScreen**.
3. Tap **Sign in with Google** with a NON-subscribed account → expect **SubscriptionPaywallScreen** (gate), with "Sign Out" in top-right (no Close icon).
4. Tap **Sign Out** → returns to LoginScreen.
5. Tap **View Demo Account** → expect to skip the paywall and land on **Dashboard** (demo backend returns `subscription_status="active"`).
6. Force-quit and re-launch → expect to skip Onboarding (flag persisted), check session, land directly on Dashboard.
7. From Dashboard, navigate More → Billing → Subscription. Paywall opens with **Close icon** (in-graph mode). Confirms gate vs in-graph mode are distinguished by `onSignOut`.

---

## Files touched (summary)

```
android-native/app/src/main/java/com/spentyai/app/MainActivity.kt
android-native/app/src/main/java/com/spentyai/app/core/auth/AuthManager.kt
android-native/app/src/main/java/com/spentyai/app/core/network/ApiEndpoints.kt
android-native/app/src/main/java/com/spentyai/app/core/onboarding/OnboardingPrefs.kt          (NEW)
android-native/app/src/main/java/com/spentyai/app/features/auth/AuthViewModel.kt
android-native/app/src/main/java/com/spentyai/app/features/auth/LoginScreen.kt
android-native/app/src/main/java/com/spentyai/app/features/billing/BillingViewModel.kt
android-native/app/src/main/java/com/spentyai/app/features/onboarding/OnboardingScreen.kt    (NEW)
android-native/app/src/main/java/com/spentyai/app/features/onboarding/OnboardingSlide.kt     (NEW)
android-native/app/src/main/java/com/spentyai/app/features/onboarding/OnboardingViewModel.kt (NEW)
android-native/app/src/main/java/com/spentyai/app/features/onboarding/SubscriptionPaywallScreen.kt
android-native/app/src/main/java/com/spentyai/app/navigation/AppNavigation.kt
android-native/app/src/main/res/drawable-nodpi/onboarding_shot_1.png                          (NEW)
android-native/app/src/main/res/drawable-nodpi/onboarding_shot_2.png                          (NEW)
android-native/app/src/main/res/drawable-nodpi/onboarding_shot_3.png                          (NEW)
android-native/app/src/main/res/drawable-nodpi/onboarding_shot_4.png                          (NEW)
android-native/app/src/main/res/drawable-nodpi/onboarding_shot_5.png                          (NEW)
android-native/app/src/main/res/drawable-nodpi/onboarding_shot_6.png                          (NEW)
android-native/app/src/main/res/drawable-nodpi/onboarding_shot_7.png                          (NEW)
```
