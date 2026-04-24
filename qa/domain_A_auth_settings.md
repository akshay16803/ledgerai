# Domain A — Authentication, Onboarding, Settings, Localization & Reset Data

**App:** SpentyAI iOS (native SwiftUI, `@Observable` state, iOS 17+)
**Scope:** Cold start → sign-in (Google OAuth via `ASWebAuthenticationSession` + PKCE; simulator dev-login), first-launch onboarding (seed defaults, paywall), Settings (Business Profile, Currency & Locale, Invoice Customization, Sign Out, Reset Data, Delete Account), Localization (EN/HI), Siri App Shortcuts, force-quit restore, accessibility.

**Code under test (verified paths):**
- `ios/SpentyAI/SpentyAI/SpentyAIApp.swift`
- `ios/SpentyAI/SpentyAI/Navigation/AppRouter.swift`, `Navigation/MainTabView.swift`
- `ios/SpentyAI/SpentyAI/Core/Auth/{AuthManager,GoogleSignInHelper,KeychainHelper}.swift`
- `ios/SpentyAI/SpentyAI/Core/Localization/{LocalizationManager,AppStrings}.swift` (AppStrings has 651 lines, every key is EN + HI only)
- `ios/SpentyAI/SpentyAI/Core/Networking/{APIClient,APIEndpoints,APIError}.swift`
- `ios/SpentyAI/SpentyAI/Features/Auth/{AuthViewModel,LoginView}.swift`
- `ios/SpentyAI/SpentyAI/Features/Settings/{SettingsView,SettingsViewModel,SettingsRepository,BusinessProfileView,CurrencySettingsView}.swift`
- `ios/SpentyAI/SpentyAI/Features/Onboarding/SubscriptionPaywall.swift` (the only "onboarding" screen)
- `ios/SpentyAI/SpentyAI/Features/SiriIntents/{AppShortcuts,CheckBalanceIntent,RecordExpenseIntent,RecordIncomeIntent}.swift`
- `backend/server.py` (lines 230–640 auth helpers/routes, 9462–9505 `/api/settings/reset-data`, 600–632 `/api/auth/delete-account`, 634–710 `seed_default_data`)

**Key code-level facts the tester must know before executing:**
1. There is NO separate sign-up / email-password flow — the ONLY primary auth is "Sign in with Google" (`GoogleSignInHelper`). On `#if targetEnvironment(simulator)`, `AuthManager.checkSession()` auto-logs-in via `/api/auth/dev/simulator-login` with hardcoded email `akshaychouhan16803@gmail.com` and dev secret `spenty-sim-bypass-2026`, and falls back to an OFFLINE synthetic user if the API call fails.
2. First-launch seed: `seed_default_data(user_id)` in `server.py` creates 3 default accounts (Cash, Bank Account, Credit Card — all INR) + 5 income categories (with sub-categories Salary/Business/Investment/Rental/Other) + 10 expense categories. It runs BOTH on first `/api/auth/google/mobile` signup AND after every `/api/settings/reset-data`.
3. `SpentyAIApp` shows `AppRouter`, which renders `LoadingView` while `authManager.isLoading`, else `LoginView` if not authed, else `SubscriptionPaywall` if `!user.hasActiveSubscription`, else `MainTabView`. There is NO custom first-launch onboarding screen other than the paywall.
4. Session expiry is broadcast via `NotificationCenter` `.userSessionExpired` whenever APIClient gets a 401 AND there is a keychain session token (see `APIClient.validateResponse` lines 191–205). `AuthManager.init()` observes this notification and force-logs-out.
5. Logout: the client calls `POST /api/auth/logout` but the backend reads session from COOKIE only — for mobile it is effectively a no-op server-side; the keychain token remains valid until its 30-day DB expiry. The iOS side deletes the keychain token regardless.
6. Settings backend collections affected by Reset Data vs Delete Account differ: Reset DOES NOT delete `user_settings` / `users` / `user_sessions`, and re-seeds defaults. Delete DOES delete all of the above.
7. Language toggle is NOT in `SettingsView`. It lives in the Dashboard toolbar (`DashboardView.swift` line 38). Only two languages: `en` / `hi`. `LocalizationManager.toggle()` flips between them and persists to `UserDefaults` key `app_language`.
8. There is NO theme/dark-mode, notifications, privacy-policy link, terms link, refund-policy link, about screen, or version display inside `SettingsView`. Terms & Privacy links exist ONLY in `LoginView` (markdown link in footer) and `SubscriptionPaywall`. **This is a discrepancy vs. the App Store submission checklist** — raise as a finding, not a bug per-test.
9. `SettingsViewModel` is re-initialized inside `SettingsView.task` with the real `authManager` only ON FIRST appearance (`hasInitialized` gate). The first stateful read of `viewModel.settings.firmName` may show stale data from the throwaway initial VM.
10. Siri App Shortcuts phrases are hard-coded English in `AppShortcuts.swift` — no Hindi shortcut support.

---

## Priorities
- **P0** — Blocks App Store release or causes data loss / security issue
- **P1** — Major user-facing bug but app still usable
- **P2** — Cosmetic / edge-case
- **P3** — Nice-to-have polish

## Bug Severity
- **App Store blocker** — guideline violation, crash, data loss, auth bypass
- **High** — feature broken for mainstream path
- **Medium** — workaround exists
- **Low** — cosmetic

---

## Section 1 — Cold start, launch & routing

### A01 — Fresh install cold start on device (no prior keychain)
**Priority:** P0
**Pre-conditions:** Delete the app from device, reinstall via Xcode USB. Device is online.
**Steps:**
1. Tap the app icon.
2. Observe the first screen rendered.
3. Note the delay between launch-screen dismissal and first interactive screen.
**Expected result:** `LoadingView` with "Checking your session..." appears briefly (<2s on Wi-Fi), then transitions to `LoginView` (logo + "Sign in with Google" button + Terms/Privacy footer). No crash, no blank screen, no duplicate splash.
**Bug severity if fails:** App Store blocker

### A02 — Cold start with valid keychain session token
**Priority:** P0
**Pre-conditions:** Previously signed in successfully; force-quit app; token still in keychain and not expired.
**Steps:**
1. Relaunch the app.
2. Watch router transitions.
**Expected result:** `LoadingView` shown while `/api/auth/me` resolves, then `MainTabView` (Dashboard tab selected). User never sees `LoginView`.
**Bug severity if fails:** High

### A03 — Cold start on simulator auto-login happy path
**Priority:** P0
**Pre-conditions:** Running in iOS Simulator; backend reachable; user `akshaychouhan16803@gmail.com` exists in DB.
**Steps:**
1. Clean build and run on simulator.
2. Observe logs for `[SimulatorBypass] Auto-login successful via API`.
**Expected result:** Goes straight from `LoadingView` to `MainTabView` without ever showing `LoginView`. Keychain has a non-`sim-offline-token-*` token.
**Bug severity if fails:** High (dev workflow, not shipped to end users)

### A04 — Cold start on simulator with backend unreachable → offline fallback
**Priority:** P1
**Pre-conditions:** Simulator; kill local backend or disable network.
**Steps:**
1. Launch app.
2. Observe logs.
**Expected result:** Log `[SimulatorBypass] Offline fallback login successful`; user object appears as "Akshay Chouhan" with `subscription_plan: lifetime`; `MainTabView` renders. Keychain token starts with `sim-offline-token-`.
**Bug severity if fails:** Medium (dev only)

### A05 — Launch screen layout
**Priority:** P2
**Pre-conditions:** Any launch.
**Steps:**
1. Observe the launch screen (storyboard/asset) during splash.
**Expected result:** Static splash matches brand guidelines (no placeholder text, no "Launch Screen" dev asset).
**Bug severity if fails:** App Store blocker if placeholder; else Low

### A06 — LoadingView message localized
**Priority:** P2
**Pre-conditions:** App configured to Hindi.
**Steps:**
1. Sign out so `LoadingView` appears briefly on next cold start, OR trigger paywall refresh.
**Expected result:** "Checking your session..." string should be localized. **NOTE:** Currently hard-coded English in `AppRouter.swift` — log as bug.
**Bug severity if fails:** Low

---

## Section 2 — LoginView layout & first-run appearance

### A07 — LoginView layout at default Dynamic Type (iPhone 15 Pro)
**Priority:** P1
**Pre-conditions:** On LoginView.
**Steps:**
1. Observe spacing, logo, title, subtitle, button, footer terms/privacy links.
**Expected result:** Dollar-sign SF Symbol circle logo centered, "SpentyAI" 34pt rounded bold in spentyPrimary, "Smart spending" subtitle, "Sign in with Google" button filled with spentyPrimary, white text, shadow; footer rich text with two tappable Markdown links (Terms, Privacy).
**Bug severity if fails:** Medium

### A08 — LoginView at smallest Dynamic Type
**Priority:** P2
**Pre-conditions:** Settings → Accessibility → Display & Text Size → Larger Text → set to smallest.
**Steps:**
1. Launch the app and reach LoginView.
**Expected result:** All content still visible; no unreadable text; button at least 44×44pt touch target.
**Bug severity if fails:** Medium

### A09 — LoginView at largest accessibility Dynamic Type
**Priority:** P1
**Pre-conditions:** Set Dynamic Type slider to max (AX5).
**Steps:**
1. Launch; reach LoginView.
**Expected result:** Text wraps instead of truncating; Google button grows in height and text wraps; footer terms/privacy paragraph remains tappable; no content clipped off-screen bottom.
**Bug severity if fails:** High (App Store accessibility)

### A10 — LoginView in landscape orientation
**Priority:** P2
**Pre-conditions:** iPad / iPhone in landscape.
**Steps:**
1. Rotate device on LoginView.
**Expected result:** Layout reflows, logo + button remain centered, no overlap.
**Bug severity if fails:** Low

### A11 — LoginView localized in Hindi
**Priority:** P1
**Pre-conditions:** Signed out; launch app after toggling Hindi (requires first running Dashboard → toggle → sign out).
**Steps:**
1. Reach LoginView in Hindi.
**Expected result:** "Sign in with Google" rendered as "Google से साइन इन करें" (key `sign_in_google`). Footer Terms/Privacy hard-coded English (**known limitation, log**).
**Bug severity if fails:** Medium

### A12 — Tap Terms of Service link on LoginView
**Priority:** P1
**Pre-conditions:** On LoginView, online.
**Steps:** Tap the "Terms of Service" underline link.
**Expected result:** In-app Safari or external Safari opens `https://spentyai.com/terms` and renders the published page.
**Bug severity if fails:** Medium

### A13 — Tap Privacy Policy link on LoginView
**Priority:** P0
**Pre-conditions:** On LoginView, online.
**Steps:** Tap the "Privacy Policy" underline link.
**Expected result:** Safari opens `https://spentyai.com/privacy`; page loads without 404. Required by App Store Guideline 5.1.1.
**Bug severity if fails:** App Store blocker

### A14 — Terms/Privacy links offline
**Priority:** P2
**Pre-conditions:** Airplane mode enabled, on LoginView.
**Steps:** Tap each link.
**Expected result:** Safari shows its "No Internet Connection" page — no crash in SpentyAI.
**Bug severity if fails:** Low

---

## Section 3 — Google Sign-In happy & unhappy paths

### A15 — Google Sign-In happy path (new user)
**Priority:** P0
**Pre-conditions:** Google account that has never signed in to SpentyAI before. Device online.
**Steps:**
1. Tap "Sign in with Google".
2. Approve the consent screen shown by ASWebAuthenticationSession.
3. Wait for redirect.
**Expected result:** Web auth sheet dismisses; loading spinner briefly visible; `AuthManager.login()` logs `success, userId=user_...`; router transitions to `SubscriptionPaywall` (because new user has no subscription). Backend creates user + runs `seed_default_data`.
**Bug severity if fails:** App Store blocker

### A16 — Google Sign-In happy path (returning user with active subscription)
**Priority:** P0
**Pre-conditions:** Account with `subscription_status == "active"`.
**Steps:** Tap Sign in with Google → consent → complete.
**Expected result:** Router skips paywall and goes directly to `MainTabView`/Dashboard.
**Bug severity if fails:** App Store blocker

### A17 — Google Sign-In — user cancels system consent sheet
**Priority:** P0
**Pre-conditions:** Tap "Sign in with Google".
**Steps:**
1. When the iOS sheet asks "SpentyAI wants to use google.com to sign in", tap **Cancel**.
**Expected result:** Sheet dismisses, LoginView re-appears unchanged. No error alert, no error banner (`APIError.cancelled` is silently swallowed in `AuthViewModel`). `viewModel.isLoading` returns to `false`.
**Bug severity if fails:** High

### A18 — Google Sign-In — cancel in-flight by swipe-down
**Priority:** P1
**Pre-conditions:** Tap "Sign in with Google"; Google OAuth page loads.
**Steps:** Swipe the ASWebAuthenticationSession sheet down to dismiss.
**Expected result:** Same as A17 — no error banner, button re-enabled.
**Bug severity if fails:** Medium

### A19 — Google Sign-In with network dropped mid-flight
**Priority:** P1
**Pre-conditions:** On LoginView.
**Steps:**
1. Tap Sign in with Google.
2. Before consent completes, enable Airplane mode.
3. Tap the approve button.
**Expected result:** Error alert with localized "Sign In Error" title and an error message. Button re-enabled. LoginView remains.
**Bug severity if fails:** High

### A20 — Google Sign-In — token exchange returns 500
**Priority:** P1
**Pre-conditions:** Intercept `https://oauth2.googleapis.com/token` via Charles/mitmproxy; force 500.
**Steps:** Attempt sign-in.
**Expected result:** `APIError.serverError` surfaces via alert: "Token exchange failed (500): ...". No crash.
**Bug severity if fails:** High

### A21 — Google Sign-In — backend `/api/auth/google/mobile` returns 401
**Priority:** P1
**Pre-conditions:** Backend mock returns 401 (invalid id_token case).
**Steps:** Sign in.
**Expected result:** Error alert with localized description; no `userSessionExpired` notification fires because the 401 predates having a keychain token (checked by APIClient guard).
**Bug severity if fails:** High

### A22 — Google Sign-In — backend returns 500
**Priority:** P1
**Pre-conditions:** Backend forced to 500 on `/api/auth/google/mobile`.
**Steps:** Sign in.
**Expected result:** Error alert "Internal server error". Error message ALSO stored in `authManager.lastLoginError` — if the user backgrounds the app and returns, `LoginView.onAppear` re-surfaces the error.
**Bug severity if fails:** Medium

### A23 — Google Sign-In — invalid redirect scheme config
**Priority:** P1
**Pre-conditions:** Edit `Config.plist` to remove `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_CLIENT_ID`.
**Steps:** Launch, tap Sign in.
**Expected result:** Immediate error alert "Google Sign-In is not configured — missing iOS client ID in Config.plist" (`APIError.badRequest`). No ASWebAuthenticationSession is ever shown.
**Bug severity if fails:** Medium (dev-time)

### A24 — Google Sign-In — PKCE code verifier reuse prevention
**Priority:** P2
**Pre-conditions:** Two rapid Sign-In attempts.
**Steps:**
1. Tap Sign in.
2. Before consent completes, tap home → reopen → tap Sign in again.
**Expected result:** Each attempt generates a fresh PKCE verifier (32 random bytes base64). Second flow completes independently; first is silently cancelled.
**Bug severity if fails:** Medium

### A25 — Google Sign-In persists `lastLoginError` across LoginView recreation
**Priority:** P2
**Pre-conditions:** Force a backend error.
**Steps:**
1. Trigger an auth error alert.
2. Dismiss it.
3. Trigger another error without force-quit.
**Expected result:** Each error shows fresh; no stale stacking. `lastLoginError` is cleared by `onAppear` handler after recovery.
**Bug severity if fails:** Low

### A26 — Google Sign-In while keychain already has a valid token
**Priority:** P2
**Pre-conditions:** Keychain has a valid token AND `isAuthenticated = false` (shouldn't normally happen; force via bug repro by clearing isAuthenticated only).
**Steps:** Tap Sign in with Google.
**Expected result:** Flow completes; new token overwrites old (KeychainHelper.save deletes before adding).
**Bug severity if fails:** Low

---

## Section 4 — Session persistence & token behavior

### A27 — Session persists across app force-quit
**Priority:** P0
**Pre-conditions:** Signed in, on Dashboard.
**Steps:**
1. Double-tap Home / swipe up to app switcher.
2. Swipe SpentyAI up to kill.
3. Relaunch.
**Expected result:** Goes straight to Dashboard without LoginView.
**Bug severity if fails:** App Store blocker

### A28 — Session persists across device reboot
**Priority:** P1
**Pre-conditions:** Signed in.
**Steps:**
1. Reboot device.
2. Unlock (required because keychain uses `kSecAttrAccessibleAfterFirstUnlock`).
3. Launch app.
**Expected result:** Auto-login, goes to Dashboard.
**Bug severity if fails:** High

### A29 — 30-day session expiry at the server
**Priority:** P1
**Pre-conditions:** Manually age a session in DB: set `user_sessions.expires_at` to 1 minute ago.
**Steps:**
1. Cold-launch app (so `checkSession` runs).
**Expected result:** `/api/auth/me` returns 401 → `APIClient.validateResponse` posts `.userSessionExpired` → `AuthManager` logs out → LoginView shown. Keychain token deleted.
**Bug severity if fails:** High

### A30 — Expired token mid-session while browsing
**Priority:** P1
**Pre-conditions:** On Dashboard. Expire session in DB.
**Steps:**
1. Navigate to Accounts tab (triggers a network call).
**Expected result:** 401 → session-expired notification → AuthManager resets `isAuthenticated` → router animates to LoginView. No crash; pending tasks cancel cleanly.
**Bug severity if fails:** High

### A31 — Token missing but user still `isAuthenticated == true` (edge case)
**Priority:** P2
**Pre-conditions:** Manually delete keychain entry while app is in background (not realistic, but tests defensive code).
**Steps:** Resume app, make a network call.
**Expected result:** APIClient sends no Authorization header → backend 401 → session-expired flow triggers. (BUG in current code: APIClient only fires `.userSessionExpired` if keychain HAS a token — if token was missing, notification won't fire and user will be stuck. Worth confirming.)
**Bug severity if fails:** Medium

### A32 — 401 on unauthenticated endpoint (e.g. `/api/auth/google/mobile`) does NOT log out
**Priority:** P1
**Pre-conditions:** LoginView.
**Steps:** Trigger 401 by sending bad id_token.
**Expected result:** Normal error alert shown. No `.userSessionExpired` notification (guard: keychain must have a token).
**Bug severity if fails:** Medium

### A33 — Background for > 10 min, foreground → session still works
**Priority:** P2
**Pre-conditions:** Signed in.
**Steps:**
1. Background app.
2. Wait 12 minutes.
3. Foreground and tap a tab.
**Expected result:** Cached screen still rendered; subsequent network call succeeds.
**Bug severity if fails:** Medium

### A34 — Background for > 30 days → session expires
**Priority:** P2
**Pre-conditions:** Signed in; wait >30 days (or simulate by adjusting device date; Keychain survives but server session is stale).
**Steps:** Foreground.
**Expected result:** Next `/api/auth/me` returns 401 → logged out.
**Bug severity if fails:** Medium

---

## Section 5 — Logout

### A35 — Sign Out from Settings → More → Settings
**Priority:** P0
**Pre-conditions:** Signed in, on Dashboard.
**Steps:**
1. Tap More tab → Settings.
2. Scroll to Account section, tap "Sign Out".
**Expected result:** Client calls `POST /api/auth/logout` (best-effort), deletes keychain token, `isAuthenticated = false`, router animates to LoginView.
**Bug severity if fails:** App Store blocker

### A36 — Sign Out with backend unreachable
**Priority:** P1
**Pre-conditions:** Airplane mode ON while on Settings.
**Steps:** Tap Sign Out.
**Expected result:** Keychain cleared regardless of backend error; LoginView appears. No error alert blocking the user.
**Bug severity if fails:** High

### A37 — Sign Out — confirmation missing (bug or intended?)
**Priority:** P2
**Pre-conditions:** On Settings.
**Steps:** Tap Sign Out.
**Expected result:** Currently **no confirmation dialog** — sign-out is immediate. Log as a UX concern for accidental taps.
**Bug severity if fails:** Low

### A38 — Re-login after Sign Out uses fresh Google consent
**Priority:** P2
**Pre-conditions:** Just signed out.
**Steps:**
1. Tap Sign in with Google again.
**Expected result:** If `prefersEphemeralWebBrowserSession = false` (current), Safari session cookies may remember the Google account — one tap sign-in possible. Verify this matches intended UX.
**Bug severity if fails:** Low

### A39 — Sign Out clears all in-memory view-model state
**Priority:** P1
**Pre-conditions:** Signed in; had loaded Dashboard data.
**Steps:**
1. Sign out, sign back in with a DIFFERENT Google account.
**Expected result:** New user's data shown, not cached previous user's data. Dashboard, Accounts, Categories all refetch.
**Bug severity if fails:** High (data-leak risk)

---

## Section 6 — First-launch / post-signup onboarding

### A40 — New user sees SubscriptionPaywall immediately after signup
**Priority:** P0
**Pre-conditions:** Brand-new Google account.
**Steps:** Complete Google Sign-In.
**Expected result:** `SubscriptionPaywall` renders (hero, plan selection, Subscribe button, Terms/Privacy). MainTabView NOT reachable until subscribed.
**Bug severity if fails:** App Store blocker

### A41 — Backend seeds 3 default accounts for new user
**Priority:** P0
**Pre-conditions:** New signup completed.
**Steps:**
1. Complete subscription (or use lifetime test account).
2. Navigate to Accounts tab.
**Expected result:** Accounts list shows: Cash (asset/cash, INR, 0), Bank Account (asset/bank, INR, 0), Credit Card (liability/credit_card, INR, 0) — from `seed_default_data`.
**Bug severity if fails:** App Store blocker (empty-state confusion)

### A42 — Backend seeds default income & expense categories
**Priority:** P0
**Pre-conditions:** New signup.
**Steps:** Navigate to More → Categories.
**Expected result:** 5 income parent categories (Salary, Business Income, Investment Income, Rental Income, Other Income) with listed sub-categories; 10 expense parent categories (Food & Dining, Transportation, Housing, Shopping, Healthcare, Entertainment, Education, Bills & Utilities, Personal Care, Other Expenses) with sub-categories where defined.
**Bug severity if fails:** High

### A43 — Seed does NOT run twice if user signs in again
**Priority:** P1
**Pre-conditions:** Existing user.
**Steps:**
1. Sign out.
2. Sign in with same Google account.
3. Check categories count in DB.
**Expected result:** No duplicate seeding — `google_mobile_login` only calls `seed_default_data` when creating a new user.
**Bug severity if fails:** High (data corruption)

### A44 — No custom onboarding carousel / walkthrough exists
**Priority:** P2
**Pre-conditions:** Code review.
**Steps:** Search for any `OnboardingView`/tour/walkthrough.
**Expected result:** None exists; only `SubscriptionPaywall` under `Features/Onboarding/`. Log as a product gap if customer discovery expects one.
**Bug severity if fails:** N/A (discrepancy)

### A45 — Paywall purchase happy path
**Priority:** P0
**Pre-conditions:** Paywall shown. Sandbox StoreKit account signed in.
**Steps:**
1. Select a plan.
2. Tap Subscribe.
3. Approve TouchID/FaceID purchase.
**Expected result:** StoreKit transaction succeeds → `checkEntitlements()` → `onSubscribed` callback → `authManager.checkSession()` → user now has active subscription → router shows `MainTabView`.
**Bug severity if fails:** App Store blocker

### A46 — Paywall — Restore Purchases
**Priority:** P0
**Pre-conditions:** Previously purchased via same Apple ID; new install.
**Steps:** Tap "Restore Purchases" on paywall.
**Expected result:** Entitlements re-fetched; if valid, unlocks MainTabView.
**Bug severity if fails:** App Store blocker

### A47 — Paywall cancel / back
**Priority:** P1
**Pre-conditions:** Paywall shown.
**Steps:** Attempt to dismiss without purchasing.
**Expected result:** Per current code, no "Skip" — user is locked here until subscribed OR signs out. Verify sign-out is reachable (may require explicit gesture).
**Bug severity if fails:** High

---

## Section 7 — Settings: entry & initial state

### A48 — Open Settings from More tab
**Priority:** P0
**Pre-conditions:** MainTabView.
**Steps:**
1. Tap More.
2. Scroll to Account section.
3. Tap Settings row.
**Expected result:** `SettingsView` pushes onto nav stack. Title "Settings" (localized). Form shows 4 sections: Business, Regional, Invoice Customization, Account.
**Bug severity if fails:** App Store blocker

### A49 — Settings loading state on slow network
**Priority:** P1
**Pre-conditions:** Throttle network to 3G.
**Steps:** Open Settings.
**Expected result:** `LoadingView` with "Loading settings..." while `viewModel.settings.firmName == nil`; replaced by form once loaded.
**Bug severity if fails:** Medium

### A50 — Settings offline first-open
**Priority:** P1
**Pre-conditions:** Airplane mode; open Settings for first time since install.
**Steps:** Tap Settings.
**Expected result:** Error alert "Error" with network message. Form may render with nil fields. User can dismiss the alert.
**Bug severity if fails:** Medium

### A51 — SettingsViewModel dual-init regression
**Priority:** P1
**Pre-conditions:** N/A — code-review test.
**Steps:**
1. Observe `SettingsView` `@State private var viewModel = SettingsViewModel(authManager: AuthManager())` uses a throwaway AuthManager.
2. Inside `.task`, if `!hasInitialized`, viewModel is re-created with real `authManager`.
**Expected result:** No crash when DeleteAccount invoked — because real authManager is set before user can tap Delete. But race: if user taps Delete before `.task` completes, `deleteAccount()` acts on a throwaway manager. Add test case for this race.
**Bug severity if fails:** High

### A52 — Settings section headers localized
**Priority:** P2
**Pre-conditions:** Hindi mode.
**Steps:** Open Settings.
**Expected result:** "Business" / "Regional" / "Account" / "Invoice Customization" — currently **hard-coded English** in SettingsView. Log as bug.
**Bug severity if fails:** Medium

---

## Section 8 — Settings: Business Profile

### A53 — Navigate into Business Profile
**Priority:** P0
**Pre-conditions:** On Settings.
**Steps:** Tap Business Profile row.
**Expected result:** `BusinessProfileView` pushes. Three sections: Firm Details (Firm Name), Tax Identifiers (GSTIN, PAN), Location (State picker, Country picker, Address). Save button in top-right toolbar.
**Bug severity if fails:** High

### A54 — Edit Firm Name and Save
**Priority:** P0
**Pre-conditions:** On BusinessProfileView.
**Steps:**
1. Tap Firm Name field.
2. Type "Acme Traders".
3. Tap Done on keyboard toolbar.
4. Tap Save.
**Expected result:** PUT `/api/settings` with `firmName: "Acme Traders"`. Success alert "Saved / Your business profile has been updated." Tapping OK dismisses the view and returns to Settings with updated subtitle.
**Bug severity if fails:** High

### A55 — Firm Name empty string saves as nil
**Priority:** P2
**Pre-conditions:** Firm Name currently populated.
**Steps:**
1. Clear field.
2. Save.
**Expected result:** `binding` setter converts empty → nil; backend stores null. Settings subtitle reverts to "Set up your business details".
**Bug severity if fails:** Low

### A56 — GSTIN auto-capitalization
**Priority:** P2
**Pre-conditions:** Empty GSTIN.
**Steps:** Type `29abcde1234f1z5` lowercase.
**Expected result:** Input auto-capitalizes (`textInputAutocapitalization(.characters)`) to `29ABCDE1234F1Z5`.
**Bug severity if fails:** Low

### A57 — GSTIN validation (client-side)
**Priority:** P1
**Pre-conditions:** GSTIN field.
**Steps:** Enter "INVALID".
**Expected result:** Currently **no client-side regex validation** — value accepted and POSTed. Backend also does not validate. Log as gap.
**Bug severity if fails:** Medium (compliance)

### A58 — PAN auto-capitalization
**Priority:** P2
**Pre-conditions:** PAN field.
**Steps:** Type `abcde1234f`.
**Expected result:** Becomes `ABCDE1234F`.
**Bug severity if fails:** Low

### A59 — State picker — all 36 Indian states & UTs present
**Priority:** P1
**Pre-conditions:** Location section.
**Steps:** Tap State Picker.
**Expected result:** 36 entries shown (28 states + 8 UTs), matching the hard-coded list in `BusinessProfileView.indianStates`. Include J&K, Ladakh, Delhi, Andaman & Nicobar, etc.
**Bug severity if fails:** Medium

### A60 — Country picker — ISO-code normalization
**Priority:** P1
**Pre-conditions:** User's `businessCountry` is stored as ISO code "IN" in backend.
**Steps:** Open BusinessProfileView.
**Expected result:** `countryBinding` maps "IN" → "India" for display. Save writes back "India" (not "IN"). **Possible issue:** round-trip turns ISO codes into display names on save. Log as data-consistency concern.
**Bug severity if fails:** Medium

### A61 — Country picker — "Other" catch-all
**Priority:** P2
**Pre-conditions:** Country set to a country not in list (e.g. Brazil).
**Steps:** Open BusinessProfileView.
**Expected result:** Picker falls back to the stored raw value; user can re-pick from 11 hardcoded options (India, US, UK, CA, AU, DE, FR, SG, AE, JP, Other).
**Bug severity if fails:** Medium

### A62 — Multiline address input
**Priority:** P2
**Pre-conditions:** Address field.
**Steps:** Enter a 4-line address.
**Expected result:** Field expands to `lineLimit(3...6)`; scrolls internally beyond 6 lines. Keyboard "Done" dismisses.
**Bug severity if fails:** Low

### A63 — Save while isSaving
**Priority:** P2
**Pre-conditions:** Slow network.
**Steps:** Tap Save rapidly 3 times.
**Expected result:** Save button shows ProgressView, becomes `.disabled(viewModel.isSaving)`; second/third tap ignored.
**Bug severity if fails:** Medium (double-submit)

### A64 — Save with backend 500
**Priority:** P1
**Pre-conditions:** Force backend 500.
**Steps:** Edit field, tap Save.
**Expected result:** Error alert "Internal server error"; form stays, local edits preserved.
**Bug severity if fails:** Medium

### A65 — Save while offline
**Priority:** P1
**Pre-conditions:** Airplane mode.
**Steps:** Tap Save.
**Expected result:** Error alert (network). No success dialog. Local edits preserved.
**Bug severity if fails:** Medium

### A66 — Back-gesture without saving shows no confirmation (potential data-loss)
**Priority:** P2
**Pre-conditions:** Edit Firm Name but do not tap Save.
**Steps:** Swipe right / tap back.
**Expected result:** View dismisses, edits **lost silently**. Log UX concern — should warn on unsaved changes.
**Bug severity if fails:** Medium

---

## Section 9 — Settings: Currency & Locale

### A67 — Enter Currency & Locale screen
**Priority:** P0
**Pre-conditions:** Settings.
**Steps:** Tap "Currency & Locale" row.
**Expected result:** `CurrencySettingsView` pushes. Shows two sections: Default Currency, Date Format. Loading spinner initially while `loadCurrencies()` + `loadDateFormats()` race.
**Bug severity if fails:** High

### A68 — Currency list populated from backend
**Priority:** P0
**Pre-conditions:** Online.
**Steps:** Tap the currency picker.
**Expected result:** Navigation-link picker lists currencies from `GET /api/settings/currencies` — each row shows `CODE (symbol) - Name` (e.g. "INR (₹) - Indian Rupee").
**Bug severity if fails:** App Store blocker (core UX)

### A69 — Date-format list populated
**Priority:** P0
**Pre-conditions:** Online.
**Steps:** Tap date-format picker.
**Expected result:** List shows formats with example preview on the right (e.g. "DD/MM/YYYY  —  24/04/2026").
**Bug severity if fails:** High

### A70 — Change currency & save
**Priority:** P0
**Pre-conditions:** Currency currently INR.
**Steps:**
1. Pick USD.
2. Tap Save.
**Expected result:** PUT /api/settings → success. "Saved / Currency and locale settings have been updated." alert. Back in Settings, subtitle reflects new pair "USD / DD/MM/YYYY".
**Bug severity if fails:** High

### A71 — Changing currency re-renders amounts across app
**Priority:** P0
**Pre-conditions:** Dashboard has transactions.
**Steps:**
1. Note current amounts.
2. Change currency INR → USD.
3. Return to Dashboard, Transactions, Accounts, Reports.
**Expected result:** All amount displays use new currency symbol/code. (Actual behavior depends on whether views re-fetch or use local formatter — verify in each screen.) If screens don't refresh, log as bug.
**Bug severity if fails:** High

### A72 — Changing date format re-renders dates
**Priority:** P1
**Pre-conditions:** Has transactions.
**Steps:** Change format DD/MM/YYYY → MM/DD/YYYY.
**Expected result:** Every date label in Transactions, Dashboard header, Reports, CashFlow updates immediately or on next appearance.
**Bug severity if fails:** High

### A73 — Currency save while offline
**Priority:** P1
**Pre-conditions:** Airplane mode.
**Steps:** Change currency, tap Save.
**Expected result:** Error alert; selection stays in UI, not persisted.
**Bug severity if fails:** Medium

### A74 — Invalid server response for currencies
**Priority:** P2
**Pre-conditions:** Mock backend returns malformed JSON.
**Steps:** Open Currency screen.
**Expected result:** `APIError.decodingError` alert. Does not crash. Empty picker.
**Bug severity if fails:** Medium

---

## Section 10 — Settings: Invoice Customization (Logo & Signature)

### A75 — Upload logo happy path
**Priority:** P0
**Pre-conditions:** Photo library contains an image; permission granted.
**Steps:**
1. Tap "Upload Business Logo".
2. Select an image.
**Expected result:** `PhotosPicker` returns data → `repository.uploadLogo` multipart POST to `/api/settings/logo` → response URL rendered in `AsyncImage`. Spinner visible during upload.
**Bug severity if fails:** High

### A76 — Replace existing logo
**Priority:** P1
**Pre-conditions:** Logo already uploaded.
**Steps:** Tap "Replace" → pick another image.
**Expected result:** Second upload replaces first on server; AsyncImage updates.
**Bug severity if fails:** Medium

### A77 — Remove logo
**Priority:** P1
**Pre-conditions:** Logo set.
**Steps:** Tap "Remove".
**Expected result:** DELETE `/api/settings/logo` → `settings.logoUrl = nil` → placeholder shown.
**Bug severity if fails:** Medium

### A78 — Upload very large image (>5MB)
**Priority:** P2
**Pre-conditions:** Photo 10MB+.
**Steps:** Select.
**Expected result:** Either upload succeeds (server-side resize) OR backend returns 413 → error alert. No freeze/crash.
**Bug severity if fails:** Medium

### A79 — Upload logo offline
**Priority:** P1
**Pre-conditions:** Airplane mode.
**Steps:** Select image.
**Expected result:** Error alert; logoUrl unchanged.
**Bug severity if fails:** Medium

### A80 — Logo AsyncImage load failure
**Priority:** P2
**Pre-conditions:** Valid `logoUrl` saved, but CDN URL 404s.
**Steps:** Open Settings.
**Expected result:** `AsyncImage` `.failure` branch shows `photo.fill` placeholder fallback.
**Bug severity if fails:** Low

### A81 — Signature upload happy path
**Priority:** P1
**Pre-conditions:** Photo library.
**Steps:** Tap "Upload Signature" → pick.
**Expected result:** POST `/api/settings/signature` → URL stored → AsyncImage renders at 60pt max.
**Bug severity if fails:** Medium

### A82 — Signature replace / remove
**Priority:** P2
**Pre-conditions:** Signature set.
**Steps:** Replace, then Remove.
**Expected result:** Correct API calls; UI reflects both states.
**Bug severity if fails:** Medium

### A83 — Concurrent logo + signature upload
**Priority:** P2
**Pre-conditions:** Neither set.
**Steps:** Tap logo upload, before it completes tap signature upload.
**Expected result:** Both requests run; both succeed independently; both spinners visible simultaneously.
**Bug severity if fails:** Low

### A84 — PhotosPicker permission denied
**Priority:** P1
**Pre-conditions:** Settings → Privacy → Photos → deny SpentyAI.
**Steps:** Tap logo upload.
**Expected result:** System-level permission prompt or limited selection UI; no crash.
**Bug severity if fails:** High

---

## Section 11 — Settings: Sign Out, Reset Data, Delete Account

### A85 — Reset Data — warning dialog text
**Priority:** P0
**Pre-conditions:** Settings.
**Steps:** Tap "Reset Data".
**Expected result:** Alert titled (localized) "Reset All Data" with full message about transactions/accounts/invoices/bills/customers/vendors/receipts/reports being erased, Gmail/Outlook disconnected, account+settings preserved, and "This cannot be undone." Two buttons: "I Understand, Continue" (destructive red) and "Cancel".
**Bug severity if fails:** App Store blocker (data-loss UX)

### A86 — Reset Data — type-RESET gate
**Priority:** P0
**Pre-conditions:** Tapped "I Understand, Continue".
**Steps:**
1. Text field appears titled "Type RESET to Confirm".
2. Type "reset" lowercase.
**Expected result:** Field auto-capitalizes to "RESET". Confirm button "Reset My Data" only enabled when text == "RESET" exactly.
**Bug severity if fails:** App Store blocker

### A87 — Reset Data — Reset My Data tap
**Priority:** P0
**Pre-conditions:** Typed "RESET".
**Steps:** Tap "Reset My Data".
**Expected result:** POST `/api/settings/reset-data` with body `{"confirmation":"RESET"}`. Server wipes 20 collections (transactions, accounts, categories, invoices, bills, customers, vendors, mandates, statements, synced_sms, receipts, email_archives, feature_requests, tax_summaries, tax_summary_transactions, payment_orders, ai_chat_history, gmail_tokens, outlook_tokens, synced_emails, email_sync_config, outlook_sync_config, processing_locks) and RE-RUNS `seed_default_data`. `user_settings`, `users`, `user_sessions` remain.
**Bug severity if fails:** App Store blocker

### A88 — Reset Data success alert
**Priority:** P0
**Pre-conditions:** Reset API returns success.
**Steps:** Observe.
**Expected result:** Alert "Data Reset Complete / Data cleared" shown. OK triggers `loadSettings()` to refresh the view. User remains signed in. Business Profile preserved.
**Bug severity if fails:** High

### A89 — Reset Data — backend 400 when confirmation wrong
**Priority:** P2
**Pre-conditions:** Intercept and POST with wrong confirmation string (dev test only; iOS client always sends "RESET").
**Steps:** POST `/api/settings/reset-data` with `{"confirmation":"RESE"}`.
**Expected result:** Server returns 400 "You must send confirmation: 'RESET' to proceed."
**Bug severity if fails:** Low (guard)

### A90 — Reset Data offline
**Priority:** P1
**Pre-conditions:** Airplane mode, typed RESET.
**Steps:** Tap Reset My Data.
**Expected result:** Error alert; local data intact.
**Bug severity if fails:** High

### A91 — Reset Data — verify default accounts re-seeded
**Priority:** P0
**Pre-conditions:** Post-reset.
**Steps:** Open Accounts tab.
**Expected result:** Exactly 3 accounts (Cash, Bank Account, Credit Card, all INR, balance 0).
**Bug severity if fails:** High

### A92 — Reset Data — verify categories re-seeded
**Priority:** P0
**Pre-conditions:** Post-reset.
**Steps:** More → Categories.
**Expected result:** Full 5-income + 10-expense tree with sub-categories as per `seed_default_data`.
**Bug severity if fails:** High

### A93 — Reset Data — email sync tokens revoked
**Priority:** P1
**Pre-conditions:** Had connected Gmail account pre-reset.
**Steps:** After reset, go More → Email Sync.
**Expected result:** Gmail shows disconnected. Attempting to sync shows "connect Gmail" prompt — tokens are gone per `reset-data` route.
**Bug severity if fails:** High

### A94 — Reset Data — Cancel on either alert
**Priority:** P1
**Pre-conditions:** Either the warning or the type-RESET alert shown.
**Steps:** Tap Cancel.
**Expected result:** Alert dismisses; `resetConfirmText` cleared; no API call; data intact.
**Bug severity if fails:** High

### A95 — Delete Account — confirmation dialog
**Priority:** P0
**Pre-conditions:** Settings.
**Steps:** Tap "Delete Account".
**Expected result:** `.confirmationDialog` titled "Delete Account" with message (reset_warning localized) and two buttons: "Delete My Account" (destructive) + "Cancel".
**Bug severity if fails:** App Store blocker

### A96 — Delete Account — Delete happy path
**Priority:** P0
**Pre-conditions:** Tap Delete My Account.
**Steps:** Observe.
**Expected result:** DELETE `/api/auth/delete-account` → server wipes user + all 22 collections. Client clears keychain, sets `isAuthenticated = false`. Router returns to LoginView.
**Bug severity if fails:** App Store blocker

### A97 — Delete Account — attempt to sign in with same Google account again
**Priority:** P1
**Pre-conditions:** Just deleted.
**Steps:** Sign in with Google again.
**Expected result:** Backend creates a brand-new user record (because `users` collection entry was deleted). Treated as new signup → paywall. **But**: IAP subscription tied to Apple ID persists independently — verify whether new account picks that up.
**Bug severity if fails:** High

### A98 — Delete Account while offline
**Priority:** P1
**Pre-conditions:** Airplane mode.
**Steps:** Confirm delete.
**Expected result:** Error alert; account NOT deleted server-side; user still signed in on device. No silent local cleanup.
**Bug severity if fails:** High

### A99 — Delete Account — backend 500
**Priority:** P1
**Pre-conditions:** Force 500.
**Steps:** Confirm delete.
**Expected result:** Error alert via `handleError`; `isLoading` left `true` (known code path — `isLoading` is only reset inside the error branch). **Bug to watch:** `isLoading = true` but no more spinner — button remains disabled. Log.
**Bug severity if fails:** High

### A100 — Footer explains Reset vs Delete
**Priority:** P2
**Pre-conditions:** Bottom of Account section.
**Steps:** Read footer text.
**Expected result:** Localized copy from `reset_vs_delete` key clarifies difference between the two actions.
**Bug severity if fails:** Low

---

## Section 12 — Localization

### A101 — LocalizationManager defaults to English
**Priority:** P1
**Pre-conditions:** Delete app; reinstall.
**Steps:** Observe first screens.
**Expected result:** All text English (LocalizationManager reads `UserDefaults` key `app_language` → nil → defaults to "en").
**Bug severity if fails:** Medium

### A102 — Toggle English → Hindi from Dashboard
**Priority:** P0
**Pre-conditions:** On Dashboard in English.
**Steps:** Tap the "अ/A"-style toggle pill in top-right toolbar.
**Expected result:** Immediately, every `lang.s(...)` call re-evaluates — Dashboard title "Dashboard" → "डैशबोर्ड", tabs → "डैशबोर्ड / लेन-देन / खाते / रिपोर्ट / और", More menu → Hindi rows.
**Bug severity if fails:** App Store blocker (core feature)

### A103 — Toggle persists across app kill
**Priority:** P0
**Pre-conditions:** Toggled to Hindi.
**Steps:** Force-quit; relaunch.
**Expected result:** App opens in Hindi (UserDefaults read on init).
**Bug severity if fails:** High

### A104 — Toggle updates Settings labels live
**Priority:** P1
**Pre-conditions:** On Settings in English.
**Steps:** Go back to Dashboard, toggle Hindi, return to Settings.
**Expected result:** Row titles ("Business Profile", "Currency & Locale", "Reset Data", "Delete Account", "Sign Out") now Hindi; section subtitles remain hard-coded English ("Set up your business details" etc.) — **log as coverage gap**.
**Bug severity if fails:** Medium

### A105 — Toggle updates navigation tab bar
**Priority:** P1
**Pre-conditions:** MainTabView in EN.
**Steps:** Toggle Hindi.
**Expected result:** 5 tab labels switch language; tab icons unchanged.
**Bug severity if fails:** Medium

### A106 — Missing key falls back to raw key
**Priority:** P2
**Pre-conditions:** Call `lang.s("nonexistent_key")` via debug UI.
**Steps:** Observe render.
**Expected result:** Returns the raw key string "nonexistent_key". No crash.
**Bug severity if fails:** Low

### A107 — AppStrings coverage audit
**Priority:** P1
**Pre-conditions:** Code review.
**Steps:** Grep `lang.s(` vs keys in `AppStrings.strings`.
**Expected result:** Every string referenced exists. Any missing key surfaces as raw key in UI — flag.
**Bug severity if fails:** Medium

### A108 — Hindi UI at largest Dynamic Type
**Priority:** P2
**Pre-conditions:** AX5, Hindi.
**Steps:** Navigate each main screen.
**Expected result:** Devanagari text wraps cleanly; no clipping; matras not cut off.
**Bug severity if fails:** Medium

### A109 — Currency symbol per locale
**Priority:** P1
**Pre-conditions:** Base currency USD.
**Steps:** Verify amounts display with $.
**Expected result:** Amount formatter uses configured base currency, not device locale. Switching device region (iOS Settings) does NOT change app amount symbol.
**Bug severity if fails:** Medium

### A110 — Date format per saved setting
**Priority:** P1
**Pre-conditions:** Save date format "MM/DD/YYYY".
**Steps:** View Transactions list.
**Expected result:** Dates render in MM/DD/YYYY regardless of device region.
**Bug severity if fails:** Medium

### A111 — Numeric input in Hindi mode
**Priority:** P2
**Pre-conditions:** Add transaction screen, Hindi mode.
**Steps:** Tap amount → numeric keypad.
**Expected result:** Western Arabic digits (0–9) shown on keypad; no Devanagari numerals (अंक) entered.
**Bug severity if fails:** Medium

### A112 — Only two languages supported (EN/HI)
**Priority:** P2
**Pre-conditions:** Code audit of `AppStrings`.
**Steps:** Confirm no third-language columns.
**Expected result:** Only "en" and "hi" keys. No `toggle()` can produce other values. Log if marketing claims more languages.
**Bug severity if fails:** Low

---

## Section 13 — Siri App Shortcuts & Intents

### A113 — App Shortcuts appear in Shortcuts app after install
**Priority:** P1
**Pre-conditions:** Fresh install, app opened once.
**Steps:** iOS Settings → Siri & Search → SpentyAI, OR open Shortcuts app → App Shortcuts tab.
**Expected result:** Three shortcuts listed: "Record Expense", "Record Income", "Check Balance" with phrases like "Record expense in SpentyAI", etc.
**Bug severity if fails:** High

### A114 — Siri "Check my balance in SpentyAI" happy path
**Priority:** P1
**Pre-conditions:** Signed in, has accounts.
**Steps:** Invoke Siri: "Check my balance in SpentyAI".
**Expected result:** `CheckBalanceIntent.perform()` calls `/api/dashboard/summary`, replies: "Your total balance across all accounts is 12345.67. This month: income ..., expenses ...".
**Bug severity if fails:** High

### A115 — Siri Check Balance when signed out
**Priority:** P1
**Pre-conditions:** Signed out (no keychain token).
**Steps:** Invoke "Check my balance in SpentyAI".
**Expected result:** APIClient returns 401 → intent's catch block replies "Sorry, I could not check your balance. Please open SpentyAI to view your accounts."
**Bug severity if fails:** Medium

### A116 — Siri Check Balance offline
**Priority:** P2
**Pre-conditions:** Airplane mode.
**Steps:** Invoke Siri.
**Expected result:** Same fallback dialog as above.
**Bug severity if fails:** Low

### A117 — Siri Record Expense via voice
**Priority:** P1
**Pre-conditions:** Signed in.
**Steps:** "Record expense in SpentyAI" → Siri asks amount → "500" → asks description → "lunch".
**Expected result:** POST `/api/transactions` with `transactionType: expense, amount: 500, description: "lunch"`. Siri reads back confirmation. Transaction appears on Dashboard.
**Bug severity if fails:** High

### A118 — Siri Record Income via voice
**Priority:** P1
**Pre-conditions:** Signed in.
**Steps:** "Record income in SpentyAI" → "2000" → "freelance".
**Expected result:** POST with `transactionType: income`. Confirmation dialog.
**Bug severity if fails:** High

### A119 — Siri Record Expense with optional category & account
**Priority:** P2
**Pre-conditions:** Signed in; existing categories/accounts.
**Steps:** "Record expense in SpentyAI"; when asked, provide category "Food", account "Cash".
**Expected result:** Backend matches by name or creates; transaction persisted with those linkages.
**Bug severity if fails:** Medium

### A120 — Siri intent localization
**Priority:** P2
**Pre-conditions:** Device in Hindi Siri.
**Steps:** Invoke Hindi Siri phrase.
**Expected result:** Phrases are hard-coded English strings in `AppShortcuts.swift` — Hindi Siri won't trigger. Log as gap.
**Bug severity if fails:** Low

### A121 — Siri intent when not subscribed
**Priority:** P2
**Pre-conditions:** User without active subscription.
**Steps:** Invoke Record Expense.
**Expected result:** Backend allows/denies per server-side subscription gating — verify server returns 402/403 → Siri falls into catch branch.
**Bug severity if fails:** Medium

---

## Section 14 — Force-quit + relaunch on every screen

### A122 — Force-quit on Dashboard → relaunch
**Priority:** P1
**Pre-conditions:** On Dashboard.
**Steps:** Kill, relaunch.
**Expected result:** Returns to MainTabView with Dashboard selected. SwiftUI does not persist which tab was active via StateRestoration (not implemented) — so always Dashboard. Log if expectation differs.
**Bug severity if fails:** Medium

### A123 — Force-quit on Transactions tab → relaunch
**Priority:** P2
**Pre-conditions:** Transactions tab.
**Steps:** Kill, relaunch.
**Expected result:** Dashboard tab, not Transactions — no restoration.
**Bug severity if fails:** Low

### A124 — Force-quit on Settings (deep in nav stack) → relaunch
**Priority:** P2
**Pre-conditions:** More → Settings → Business Profile.
**Steps:** Kill, relaunch.
**Expected result:** Dashboard. Nav stack NOT restored.
**Bug severity if fails:** Low

### A125 — Force-quit during upload mid-flight
**Priority:** P1
**Pre-conditions:** Logo upload in progress.
**Steps:** Kill app.
**Expected result:** Upload cancelled. On relaunch, `settings.logoUrl` is nil or previous value. No orphaned half-file on server (server handles abort).
**Bug severity if fails:** High

### A126 — Force-quit during Reset Data API call
**Priority:** P0
**Pre-conditions:** Just tapped "Reset My Data", backend call pending.
**Steps:** Kill app before response.
**Expected result:** Server-side reset may have already completed (HTTP is fire-and-forget from client's perspective). On relaunch, Dashboard may show empty state. Verify data consistency.
**Bug severity if fails:** High

### A127 — Force-quit during Google OAuth mid-flight
**Priority:** P1
**Pre-conditions:** ASWebAuthenticationSession sheet shown.
**Steps:** Kill the app.
**Expected result:** On relaunch, starts at LoginView (no orphan tokens). Keychain still empty.
**Bug severity if fails:** Medium

---

## Section 15 — Accessibility

### A128 — VoiceOver on LoginView
**Priority:** P0
**Pre-conditions:** VoiceOver on (Settings → Accessibility → VoiceOver).
**Steps:** Swipe through LoginView elements.
**Expected result:** Focus order: logo → "SpentyAI" heading → "Smart spending" subtitle → "Sign in with Google, button" → Terms link → Privacy link. Button announced as button; links announced with `Link` trait. No unlabeled icons.
**Bug severity if fails:** App Store blocker (Guideline 1.5.1)

### A129 — VoiceOver on Settings rows
**Priority:** P0
**Pre-conditions:** VoiceOver on.
**Steps:** Swipe through every Settings row.
**Expected result:** Business Profile / Currency & Locale / Sign Out / Reset Data / Delete Account announced with title + subtitle. Destructive actions have appropriate role. Section headers read.
**Bug severity if fails:** High

### A130 — VoiceOver on BusinessProfileView fields
**Priority:** P1
**Pre-conditions:** VoiceOver on.
**Steps:** Navigate into BusinessProfile; focus each field.
**Expected result:** Each field announces its placeholder (Firm Name / GSTIN / PAN / State / Country / Address). Pickers announce current selection.
**Bug severity if fails:** High

### A131 — VoiceOver on Reset Data flow
**Priority:** P1
**Pre-conditions:** VoiceOver on.
**Steps:** Tap Reset Data → traverse the two alerts.
**Expected result:** Alerts announced with title + full body; Cancel button present; destructive "Reset My Data" button announced as disabled until RESET typed.
**Bug severity if fails:** High

### A132 — VoiceOver rotor can find all Settings section headers
**Priority:** P2
**Pre-conditions:** VoiceOver on, headings rotor.
**Steps:** Use rotor → Headings.
**Expected result:** "Business", "Regional", "Invoice Customization", "Account" discoverable as headings.
**Bug severity if fails:** Medium

### A133 — Dynamic Type smallest on Settings
**Priority:** P2
**Pre-conditions:** Smallest Dynamic Type.
**Steps:** Open Settings.
**Expected result:** Everything readable; no weirdly-tiny icons.
**Bug severity if fails:** Low

### A134 — Dynamic Type largest on Settings
**Priority:** P1
**Pre-conditions:** AX5.
**Steps:** Navigate Settings → Business Profile → Currency.
**Expected result:** Labels wrap, form remains usable, Save button still tappable. No truncation of critical text.
**Bug severity if fails:** High

### A135 — Bold Text accessibility toggle
**Priority:** P3
**Pre-conditions:** Settings → Accessibility → Display → Bold Text ON.
**Steps:** Launch SpentyAI.
**Expected result:** App respects system bold fonts; no layout regressions.
**Bug severity if fails:** Low

### A136 — Reduce Motion on auth transitions
**Priority:** P3
**Pre-conditions:** Reduce Motion ON.
**Steps:** Sign out → sign in.
**Expected result:** `easeInOut` transitions still play (not respecting reduce motion). Log if required.
**Bug severity if fails:** Low

### A137 — Color contrast of primary button
**Priority:** P1
**Pre-conditions:** Any screen.
**Steps:** Inspect `Color.spentyPrimary` + white text.
**Expected result:** WCAG AA contrast ≥ 4.5:1 for normal text, 3:1 for large text (the 14–17pt button text qualifies as large at semibold).
**Bug severity if fails:** High

---

## Section 16 — Deep links & URL handling

### A138 — Custom scheme handler (reversed client ID) present
**Priority:** P1
**Pre-conditions:** Build the app, inspect `Info.plist` URL Types.
**Steps:** Confirm `CFBundleURLSchemes` includes `com.googleusercontent.apps.<num>`.
**Expected result:** ASWebAuthenticationSession callback completes. If missing, OAuth redirect will fail.
**Bug severity if fails:** App Store blocker

### A139 — Universal link to https://spentyai.com/anything
**Priority:** P3
**Pre-conditions:** Associated domains config.
**Steps:** Open a spentyai.com link in Messages.
**Expected result:** Currently likely opens Safari (no Associated Domains entitlement configured). Log as expected state.
**Bug severity if fails:** Low

### A140 — OAuth callback URL with no `code` query param
**Priority:** P2
**Pre-conditions:** Simulated malformed callback.
**Steps:** Hand-craft a callback URL.
**Expected result:** `GoogleSignInHelper` throws `APIError.badRequest("No authorization code in Google callback")`; error alert.
**Bug severity if fails:** Medium

---

## Section 17 — Misc edge cases & regression

### A141 — Rapid double-tap on "Sign in with Google"
**Priority:** P1
**Pre-conditions:** LoginView.
**Steps:** Tap twice in <100ms.
**Expected result:** Second tap ignored (`.disabled(viewModel.isLoading)` on button). Only one ASWebAuthenticationSession.
**Bug severity if fails:** Medium

### A142 — Background the app during simulator dev-login
**Priority:** P3
**Pre-conditions:** Simulator cold start.
**Steps:** Press Home as `checkSession()` runs.
**Expected result:** No crash. Foreground resumes. `isAuthenticated` settled to its final value.
**Bug severity if fails:** Low

### A143 — Sign out from device A while signed in on device B (session invalidation)
**Priority:** P2
**Pre-conditions:** Two devices with same account.
**Steps:** Sign out on A → manually delete device B's session row in DB.
**Expected result:** Device B on next call gets 401 → logs out. Keychain cleared on device B.
**Bug severity if fails:** Medium

### A144 — Clock skew — device time set 2 hours ahead
**Priority:** P2
**Pre-conditions:** Set device clock +2h.
**Steps:** Launch.
**Expected result:** Server still validates token (comparing server time). Device time does not affect keychain auth.
**Bug severity if fails:** Low

### A145 — 401 from `/api/auth/me` on cold start → auto-clear token
**Priority:** P1
**Pre-conditions:** Tampered token in keychain (edit to invalid value).
**Steps:** Launch.
**Expected result:** `checkSession()` catches, deletes keychain, sets `isAuthenticated = false`. On simulator, re-attempts simulatorAutoLogin. On device, LoginView shown.
**Bug severity if fails:** High

### A146 — Keychain write failure simulation
**Priority:** P2
**Pre-conditions:** (Hard to simulate on real device; inspect code.)
**Steps:** `KeychainHelper.save` returns false.
**Expected result:** Login still SETS `isAuthenticated = true` because current code doesn't check the return value. On next cold-start, no token → back to LoginView. Log as a loss-of-session bug.
**Bug severity if fails:** High

### A147 — Keychain read returns nil after save (sandbox corruption)
**Priority:** P2
**Pre-conditions:** Simulate corrupt keychain on simulator.
**Steps:** Force-quit; relaunch.
**Expected result:** `checkSession()` finds no token → goes to LoginView (or simulator auto-login on simulator target).
**Bug severity if fails:** Medium

### A148 — Multiple Google accounts on device
**Priority:** P2
**Pre-conditions:** iCloud Keychain has passwords for 3 Google accounts.
**Steps:** Sign in.
**Expected result:** Google account chooser appears. Selecting one proceeds. Selecting "Use another account" lets user type credentials.
**Bug severity if fails:** Medium

### A149 — User revokes app's Google OAuth access externally
**Priority:** P2
**Pre-conditions:** User visits myaccount.google.com → Security → remove SpentyAI.
**Steps:** Return to app, cold launch.
**Expected result:** Existing backend session still valid (Google token is one-time, not used after exchange). App behaves normally.
**Bug severity if fails:** Low

### A150 — User signs in, then deletes SpentyAI from device without signing out
**Priority:** P2
**Pre-conditions:** Signed in on device.
**Steps:**
1. Delete app.
2. Reinstall.
3. Launch.
**Expected result:** Keychain entries for the SpentyAI service are purged on uninstall (iOS behavior). App starts from LoginView. Server session row still exists for 30 days (dangling).
**Bug severity if fails:** Medium

---

## Discrepancies Found During Code Review

1. **Spec asked for Privacy/Terms/Refund/Support/About/Version rows in Settings — none exist.** Only the LoginView footer and SubscriptionPaywall have Terms + Privacy links. Refund policy, About, and app-version display are entirely missing. Given App Store Review typically expects a visible privacy policy link from within the subscribed app, and a visible "manage subscription / refund" affordance per Apple guidelines, this is a **submission risk**.
2. **Spec asked for Notifications & Theme/Dark Mode toggles — none exist.** `SettingsView` has no notification prefs, no dark-mode toggle. SwiftUI will follow system appearance automatically, but there is no explicit user control.
3. **Language toggle not in Settings.** It lives on the Dashboard toolbar — unusual placement. Discoverable only if user finds the pill button top-right.
4. **Email / password sign-up does NOT exist** despite some backend routes like `/api/auth/verify-email`. iOS only has Google OAuth + simulator dev-login.
5. **Logout route semantics mismatch** — backend reads cookie, client sends header. Server-side session is never actually deleted on mobile logout. Session persists until 30-day expiry even after client "logout". Security concern if device stolen mid-session (though local keychain is cleared).
6. **`lastLoginError` surfaces on LoginView reappearance** — fine, but if the same error triggered repeatedly during a forced loop, same text reappears after each router bounce. Minor UX rough edge.
7. **SettingsViewModel dual-init** — throwaway `AuthManager()` used until `.task` replaces with real manager. Brief window (~0ms in practice, but race-theoretically unsound) where Delete Account could operate on wrong instance. Refactor to inject via init.
8. **Settings hard-coded English strings** — section header labels ("Business", "Regional", "Invoice Customization", "Account"), placeholders ("Set up your business details", "Set currency and date format", "Loading settings..."), alert titles ("Error", "Saved", "Delete Account"), dialog buttons ("Delete My Account", "I Understand, Continue", "Reset My Data", "Cancel"), and success messages are English-only. Hindi users see mixed-language UI.
9. **Siri phrases English-only** — no Hindi voice invocation.
10. **Reset Data backend route** wipes `synced_emails`, `email_sync_config`, `outlook_sync_config`, and `processing_locks` — these are NOT in the user-facing warning message. Consider updating dialog copy or simply documenting.
11. **AuthManager's logout sets `isLoading = true` implicitly** via `deleteAccount` error branch — if delete fails, `isLoading` left true, spinner persists. See A99.
12. **No "Manage Subscription" link in Settings** — Apple requires users be able to reach `https://apps.apple.com/account/subscriptions` from inside the app. Confirm this exists in Billing screen; if not, add to Settings (App Store blocker).
