# SpentyAI Android — Comprehensive QA Test Plan
Generated: 2026-05-01
Build under test: `com.spentyai.app` (Google Play release candidate, versionCode 1, versionName 1.0.0)
API base: `https://api.spentyai.com`

Sources:
- `/sessions/vibrant-elegant-turing/ledgerai/qa/IOS_INVENTORY.md`
- `/sessions/vibrant-elegant-turing/ledgerai/qa/ANDROID_INVENTORY.md`
- `/sessions/vibrant-elegant-turing/ledgerai/qa/PARITY_MATRIX.md`

Conventions:
- Severity: **P0** = launch-blocker (crash, lost money/data, broken auth/billing). **P1** = important (degrades experience, hides feature). **P2** = polish.
- Type: UI / Backend / E2E / Negative / Edge / Performance / a11y.
- Demo account: `spentyai6@gmail.com / akshay16803` (App Store review credentials reused for Play test).
- Reference device: Pixel 6, Android 14, default text scale, light mode unless stated.
- All endpoint paths follow the **Android** column of the parity matrix (e.g. `/api/auth/session` not `/api/auth/me`).
- Cross-reference iOS screen names per `IOS_INVENTORY.md`; "N/A — Android-only" used where there is no iOS equivalent.
- "Pending txns excluded" rule: per user instruction, `pending_review` transactions must NEVER affect cashflow, dashboard, or report totals.


---

## A. Auth flows

### TC-0001 — Cold launch on uninstalled device routes to LoginScreen
- **Area:** Auth
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** App freshly installed (`adb install`). No saved token in EncryptedSharedPreferences.
- **Steps:**
  1. Force-stop and uninstall `com.spentyai.app` from the device.
  2. Reinstall the release APK.
  3. Tap the launcher icon.
- **Expected:** App reaches `LoginScreen` (Google button + Terms / Privacy links visible) within 3 seconds. `AuthManager.isAuthenticated` is false. No crash. No bottom navigation shown.
- **Pass criteria:** Login UI rendered; `logcat` shows no fatal exceptions; `AppNavigation` start destination resolved to `login`.
- **iOS reference:** `Features/Auth/LoginView.swift`

### TC-0002 — Splash / first-paint time under 3 seconds
- **Area:** Auth
- **Type:** Performance
- **Severity:** P1
- **Preconditions:** Cold start, device unplugged, charged.
- **Steps:**
  1. Force-stop the app.
  2. Tap the launcher icon and start a stopwatch.
  3. Stop the stopwatch when LoginScreen Google button is fully drawn and tappable.
- **Expected:** Time-to-interactive ≤ 3.0s on Pixel 6.
- **Pass criteria:** Cold start ≤ 3s averaged over 3 runs. Capture `am start -W com.spentyai.app/.MainActivity` `TotalTime`.
- **iOS reference:** N/A (parity expectation)

### TC-0003 — Onboarding slider on first run
- **Area:** Auth
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Fresh install, never authenticated.
- **Steps:**
  1. Launch the app.
  2. Observe whether an onboarding slider (8 slides with segmented progress, used on iOS) appears.
- **Expected:** An 8-slide onboarding flow appears before LoginScreen, with Skip and Next/Get-Started buttons; `spenty_onboarding_slider_seen_v1` (or Android equivalent flag) is persisted.
- **Pass criteria:** Slider visible on first run, suppressed on subsequent runs.
- **Known defect:** PARITY MATRIX P0 #10 — `OnboardingSliderView` MISSING on Android. Expected outcome: FAIL until built.
- **iOS reference:** `OnboardingSliderView`

### TC-0004 — Google Sign-In happy path
- **Area:** Auth
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Signed out. Device has at least one Google account configured. Internet up.
- **Steps:**
  1. On LoginScreen, tap **Sign in with Google**.
  2. Pick the Google account from the system chooser.
  3. Approve the consent screen if shown.
- **Expected:** Google ID token returned to `MainActivity`. `POST /api/auth/google` returns 200 with session token. `AuthManager.saveToken()` persists token. App routes to Dashboard.
- **Pass criteria:** DashboardScreen shown; `GET /api/auth/session` returns 200 with current user.
- **iOS reference:** `LoginView.swift` Google button.

### TC-0005 — Google Sign-In cancelled by user
- **Area:** Auth
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Signed out.
- **Steps:**
  1. Tap **Sign in with Google**.
  2. In the account chooser, tap the system back button or the Cancel/Close affordance.
- **Expected:** App stays on LoginScreen. No error toast required, but if shown it must be dismissable. No partial token persisted. `AuthManager.isAuthenticated` remains false.
- **Pass criteria:** No crash, no infinite spinner, no token written.
- **iOS reference:** `LoginView.swift`

### TC-0006 — Google Sign-In with no internet
- **Area:** Auth
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Signed out. Enable airplane mode.
- **Steps:**
  1. Toggle airplane mode ON.
  2. Tap **Sign in with Google**.
- **Expected:** App returns to LoginScreen; the animated error banner shows a network/offline message with a dismiss IconButton. No crash.
- **Pass criteria:** Error banner visible with copy referring to network/connection. Banner is dismissable.
- **iOS reference:** `LoginView.swift` — animated error banner.

### TC-0007 — Demo Account button on LoginScreen
- **Area:** Auth
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Release build, signed out.
- **Steps:**
  1. Launch app to LoginScreen.
  2. Look for a "Demo Account" button below the Google button.
- **Expected:** Demo Account button is visible. Tapping it calls `POST /api/auth/demo-login` and signs the user in with seeded demo data.
- **Pass criteria:** Button present; tap signs in and Dashboard renders with seeded transactions/accounts.
- **Known defect:** PARITY MATRIX P0 #11 — Demo Account button MISSING on Android (only DEBUG-only Dev Login exists, hidden in release). Expected outcome: FAIL until added — required for Google Play reviewer flow.
- **iOS reference:** `LoginView.swift` Demo Account button

### TC-0008 — DEBUG-only Dev Login button hidden in release
- **Area:** Auth
- **Type:** UI / Negative
- **Severity:** P0
- **Preconditions:** Release-signed APK.
- **Steps:**
  1. Install the release APK (`-Pandroid.injected.signing.*`).
  2. Open the app to LoginScreen.
- **Expected:** The "Dev Login (Debug Only)" button is NOT visible. `BuildConfig.DEBUG` is false. Only Google (and Demo, when shipped) are visible.
- **Pass criteria:** No "Dev Login" button on screen.
- **iOS reference:** Simulator-only auto-login on iOS — same intent.

### TC-0009 — Terms and Privacy links open externally
- **Area:** Auth
- **Type:** UI
- **Severity:** P2
- **Preconditions:** LoginScreen visible.
- **Steps:**
  1. Tap the "Terms" hyperlink in the footer ClickableText.
  2. Press back, tap "Privacy".
- **Expected:** `LocalUriHandler` opens each URL in the default browser. App remains in background; coming back returns to LoginScreen.
- **Pass criteria:** Both URLs load in browser; no crash on return.
- **iOS reference:** `LoginView.swift` ToS / Privacy links.

### TC-0010 — Sign in with Apple button absent on Android
- **Area:** Auth
- **Type:** UI
- **Severity:** P2
- **Preconditions:** LoginScreen visible.
- **Steps:**
  1. Inspect LoginScreen for any Apple branding.
- **Expected:** No Sign-in-with-Apple button. (Apple is iOS-only by App Store guideline.)
- **Pass criteria:** Apple button not present; no `ApiEndpoints.appleSignIn` invocation in logs.
- **iOS reference:** `LoginView.swift` SIWA button — iOS-only by platform.

### TC-0011 — Session persists across app restart
- **Area:** Auth
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Signed in via Google.
- **Steps:**
  1. Verify Dashboard is visible.
  2. Force-stop the app via system settings.
  3. Relaunch.
- **Expected:** App skips LoginScreen, starts at Dashboard. `GET /api/auth/session` confirms 200 with same user. Token survives in EncryptedSharedPreferences.
- **Pass criteria:** No re-auth required.
- **iOS reference:** `AuthManager` Keychain persistence.

### TC-0012 — Token expiry triggers logout
- **Area:** Auth
- **Type:** E2E / Negative
- **Severity:** P0
- **Preconditions:** Signed in. Backend or proxy set up to return 401 on next call.
- **Steps:**
  1. Pull to refresh on Dashboard (or any list).
  2. Observe behaviour when 401 returned.
- **Expected:** `AuthManager` detects 401, clears token, app routes back to LoginScreen. iOS uses `.userSessionExpired` notification — Android equivalent must clear session and navigate.
- **Pass criteria:** Returned to LoginScreen; subsequent `GET /api/auth/session` returns 401 without crash.
- **iOS reference:** `AuthManager` + `.userSessionExpired` notification.

### TC-0013 — Backgrounding mid-Google-sign-in resumes correctly
- **Area:** Auth
- **Type:** Edge
- **Severity:** P1
- **Preconditions:** Signed out.
- **Steps:**
  1. Tap **Sign in with Google**.
  2. While the system account chooser is open, press Home button.
  3. Wait 30 seconds.
  4. Resume the app from Recents.
- **Expected:** App returns to LoginScreen (or completes the auth if user came back via the chooser). No half-state where ProgressBar spins forever.
- **Pass criteria:** No infinite spinner; state cleanly resolved.
- **iOS reference:** `ASWebAuthenticationSession` lifecycle.

### TC-0014 — Sign out from Settings returns to Login
- **Area:** Auth
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Signed in. Settings reachable via More -> Settings.
- **Steps:**
  1. Navigate More -> Settings.
  2. Tap **Sign Out**.
  3. Confirm the AlertDialog.
- **Expected:** `POST /api/auth/logout` returns 200. EncryptedSharedPreferences cleared. LoginScreen shown. Bottom nav not visible.
- **Pass criteria:** Returned to LoginScreen; relaunch shows LoginScreen (no auto-login).
- **iOS reference:** `SettingsView` Sign Out section.

### TC-0015 — Endpoint path verification: /api/auth/session vs /api/auth/me
- **Area:** Auth
- **Type:** Backend
- **Severity:** P0
- **Preconditions:** Signed in.
- **Steps:**
  1. Inspect network logs (mitmproxy / Charles / OkHttp interceptor) on app foreground.
- **Expected:** Android calls `GET /api/auth/session`. Backend must accept this path (or align Android to `/api/auth/me`).
- **Pass criteria:** 200 returned. If 404, file backend ticket.
- **Known defect:** PARITY MATRIX P0 #7 — endpoint mismatch with iOS. Confirm backend dual-support or align.
- **iOS reference:** `AuthManager` `/api/auth/me`.

### TC-0016 — Endpoint path verification: /api/auth/google vs /api/auth/google/mobile
- **Area:** Auth
- **Type:** Backend
- **Severity:** P0
- **Preconditions:** Pristine sign-out state.
- **Steps:**
  1. Tap Google sign-in, capture network call.
- **Expected:** Android sends `POST /api/auth/google` with id_token. iOS uses `/api/auth/google/mobile`. Backend must accept both or align.
- **Pass criteria:** 200 returned; user signed in.
- **Known defect:** PARITY MATRIX — backend alignment.
- **iOS reference:** `LoginView.swift`.

### TC-0017 — Logout endpoint matches iOS
- **Area:** Auth
- **Type:** Backend
- **Severity:** P1
- **Preconditions:** Signed in.
- **Steps:**
  1. Sign out and capture network.
- **Expected:** `POST /api/auth/logout` returns 200.
- **Pass criteria:** Token cleared and call succeeds.
- **iOS reference:** Same endpoint.

### TC-0018 — Process death + restore preserves auth
- **Area:** Auth
- **Type:** Edge
- **Severity:** P1
- **Preconditions:** Signed in. Developer Options -> "Don't keep activities" ON.
- **Steps:**
  1. Open Dashboard.
  2. Press Home.
  3. Open another heavy app (e.g. Maps) until SpentyAI is killed.
  4. Reopen SpentyAI from Recents.
- **Expected:** App restores to Dashboard with valid session; no flash of LoginScreen.
- **Pass criteria:** No re-auth prompt; data reloaded.
- **iOS reference:** N/A — Android-specific.

### TC-0019 — Configuration change (rotation) on LoginScreen
- **Area:** Auth
- **Type:** Edge / a11y
- **Severity:** P2
- **Preconditions:** Signed out. Device rotation unlocked.
- **Steps:**
  1. Open LoginScreen.
  2. Rotate to landscape.
  3. Rotate back to portrait.
- **Expected:** Layout reflows; Google button still visible and tappable; error banner state preserved if shown.
- **Pass criteria:** No crash; controls still functional.
- **iOS reference:** N/A.

### TC-0020 — Dark mode rendering on LoginScreen
- **Area:** Auth
- **Type:** UI / a11y
- **Severity:** P2
- **Preconditions:** System dark mode ON.
- **Steps:**
  1. Set system dark mode.
  2. Launch app.
- **Expected:** Material3 dark theme applied. All text legible (≥ 4.5:1 contrast). Brand colors match dark palette.
- **Pass criteria:** No invisible text; no light backgrounds in dark mode.
- **iOS reference:** N/A.

### TC-0021 — Reset onboarding via app data clear shows slider again
- **Area:** Auth
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Onboarding slider shipped (currently missing — see TC-0003).
- **Steps:**
  1. Settings -> Apps -> SpentyAI -> Storage -> Clear Data.
  2. Relaunch.
- **Expected:** Slider shown again as if first run.
- **Pass criteria:** Slider re-appears.
- **Known defect:** Depends on TC-0003 fix.
- **iOS reference:** Toggle of `spenty_onboarding_slider_seen_v1`.

### TC-0022 — Delete Account flow signs user out and clears state
- **Area:** Auth
- **Type:** E2E / Destructive
- **Severity:** P0
- **Preconditions:** Test account that is safe to delete (NOT the demo account). Signed in.
- **Steps:**
  1. Settings -> **Delete Account**.
  2. Confirm the AlertDialog.
- **Expected:** `DELETE /api/auth/account` returns 200. Local token cleared. App returned to LoginScreen. Subsequent re-login attempts fail until account is recreated.
- **Pass criteria:** Server confirms account deletion; local state purged.
- **Known defect:** PARITY MATRIX — endpoint differs from iOS (`/api/auth/account` vs `/api/auth/delete-account`). Verify backend dual-support.
- **iOS reference:** `SettingsView` Delete Account.

### TC-0023 — Reset Data 3-step flow
- **Area:** Auth / Settings
- **Type:** E2E / Destructive
- **Severity:** P0
- **Preconditions:** Signed in as a non-demo test account with seeded transactions.
- **Steps:**
  1. Settings -> **Reset Data** (orange row).
  2. Confirm the warning AlertDialog.
  3. In the next dialog, type **RESET** in the OutlinedTextField.
  4. Tap Confirm.
- **Expected:** All transactions, accounts, mandates, records, etc., are removed server-side. Success dialog shown. Dashboard reloads with empty state.
- **Pass criteria:** Server returns 200 from reset endpoint; subsequent `GET /api/dashboard/summary` shows zeroed totals.
- **Known defect:** PARITY MATRIX P1 #44 — verify `POST /api/settings/reset-data` is invoked (Android may currently `PUT /api/settings`).
- **iOS reference:** `SettingsView` Reset Data — iOS uses RESET-typed confirm.

### TC-0024 — Concurrent sessions: web sign-out doesn't kick Android session immediately
- **Area:** Auth
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Signed in on Android and on `www.spentyai.com`.
- **Steps:**
  1. Sign out on web.
  2. Pull-to-refresh on Android.
- **Expected:** Android either continues working with its own token (separate session) or gracefully logs out via 401. No crash, no inconsistent state.
- **Pass criteria:** Behaviour matches whichever model the backend implements; no infinite spinner.
- **iOS reference:** Same expectation.

### TC-0025 — Server 500 during sign-in
- **Area:** Auth
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Backend mocked to return 500 on `POST /api/auth/google`.
- **Steps:**
  1. Tap Google sign-in.
- **Expected:** Error banner shows generic "Something went wrong, please try again". No crash. User can retry.
- **Pass criteria:** Banner dismissable; retry works once backend recovers.
- **iOS reference:** Same.

---

## B. Dashboard

### TC-0026 — Dashboard loads with correct totals
- **Area:** Dashboard
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Signed in as demo account with seeded data.
- **Steps:**
  1. Sign in with demo credentials.
  2. Wait for Dashboard to render.
  3. Capture network call `GET /api/dashboard/summary`.
- **Expected:** Net worth, total balance, income, expenses, and pending count all match the API response. Numbers are non-zero for the demo account.
- **Pass criteria:** UI values equal API values (within ₹0.01 rounding).
- **iOS reference:** `DashboardView.swift` 4 stat cards.

### TC-0027 — Dashboard pending count excludes approved transactions
- **Area:** Dashboard
- **Type:** Backend / E2E
- **Severity:** P0
- **Preconditions:** Demo user with at least 3 pending and 5 approved txns.
- **Steps:**
  1. Open Dashboard.
  2. Read pending banner count.
- **Expected:** Count equals the number of `pending_review`-status transactions only. Approved ones are NOT counted.
- **Pass criteria:** Matches `GET /api/email/pending-review` `count`.
- **iOS reference:** `DashboardView` pending banner.

### TC-0028 — Pending transactions excluded from income/expense/net-worth totals
- **Area:** Dashboard
- **Type:** Backend
- **Severity:** P0
- **Preconditions:** Seed account with 1 approved expense ₹100 and 1 pending expense ₹500.
- **Steps:**
  1. Open Dashboard.
- **Expected:** Expense KPI = ₹100 only. Pending ₹500 not added.
- **Pass criteria:** Per `feedback_pending_transactions.md` — pending must NEVER affect totals.
- **iOS reference:** Same rule.

### TC-0029 — Pull-to-refresh on Dashboard
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Dashboard visible.
- **Steps:**
  1. Drag down on the LazyColumn.
  2. Release.
- **Expected:** Refresh indicator appears; `GET /api/dashboard/summary` re-fired; values refresh.
- **Pass criteria:** Refresh works without flicker.
- **Known defect:** PARITY MATRIX P1 #34 — pull-to-refresh not confirmed on DashboardScreen. Expected: implement.
- **iOS reference:** `DashboardView.swift` `.refreshable`.

### TC-0030 — Tap Net Worth card navigates to drill-down
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Dashboard visible.
- **Steps:**
  1. Tap the Net Worth stat card.
- **Expected:** Opens accounts list / drill-down sheet showing all accounts contributing to net worth.
- **Pass criteria:** Navigation occurs.
- **Known defect:** PARITY MATRIX — `DashboardAccountsListView` MISSING on Android. Expected: FAIL.
- **iOS reference:** `DashboardAccountsListView`.

### TC-0031 — Tap Income card navigates to filtered transactions
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Dashboard visible.
- **Steps:**
  1. Tap the Income KPI card.
- **Expected:** Opens transaction list filtered to income for current period.
- **Pass criteria:** TransactionListScreen pre-filtered.
- **Known defect:** PARITY MATRIX — `DashboardFilteredTransactionsView` MISSING. Expected: FAIL.
- **iOS reference:** `DashboardFilteredTransactionsView`.

### TC-0032 — Tap Expenses card navigates to filtered transactions
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Dashboard visible.
- **Steps:**
  1. Tap the Expenses KPI card.
- **Expected:** Opens TransactionListScreen filtered to expenses.
- **Pass criteria:** Filter applied and results match.
- **Known defect:** Same MISSING as TC-0031.
- **iOS reference:** `DashboardFilteredTransactionsView`.

### TC-0033 — Tap pending banner opens PendingReviewScreen
- **Area:** Dashboard
- **Type:** UI / E2E
- **Severity:** P0
- **Preconditions:** Demo account with pending txns.
- **Steps:**
  1. Tap the pending review banner on Dashboard.
- **Expected:** Navigates to `PendingReviewScreen`. List populated from `GET /api/email/pending-review`.
- **Pass criteria:** Navigation works; list populated.
- **iOS reference:** `DashboardAllPendingView` (sheet on iOS, route on Android — accepted).

### TC-0034 — Account row click navigates to AccountDetail
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Dashboard with at least one account in horizontal accounts row.
- **Steps:**
  1. Tap an account card.
- **Expected:** Navigates to `AccountDetailScreen` for that account.
- **Pass criteria:** Bottom bar hidden; back returns to Dashboard.
- **iOS reference:** Dashboard accounts row.

### TC-0035 — Recent transaction row click opens TransactionDetail
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Dashboard with at least one recent txn.
- **Steps:**
  1. Tap any recent transaction row.
- **Expected:** Navigates to `TransactionDetailScreen` showing the txn details.
- **Pass criteria:** Detail loads correctly; back returns.
- **iOS reference:** Dashboard recent-txn rows.

### TC-0036 — FAB + opens TransactionFormScreen ModalBottomSheet
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Dashboard visible.
- **Steps:**
  1. Tap the floating + FAB.
- **Expected:** `TransactionFormScreen` opens as a ModalBottomSheet over Dashboard.
- **Pass criteria:** Sheet visible; cancel restores Dashboard.
- **iOS reference:** Dashboard FAB.

### TC-0037 — AI sparkle icon opens AI Chat
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Dashboard visible.
- **Steps:**
  1. Tap the `Icons.Filled.AutoAwesome` icon in the top app bar.
- **Expected:** Navigates to `ai_chat` route as a full-screen destination. Bottom bar hidden.
- **Pass criteria:** AIChatScreen rendered.
- **iOS reference:** AI sparkle on iOS opens as sheet — Android variation accepted.

### TC-0038 — Dashboard collapsing scroll behaviour
- **Area:** Dashboard
- **Type:** UI / a11y
- **Severity:** P2
- **Preconditions:** Dashboard with enough content to scroll.
- **Steps:**
  1. Scroll down.
  2. Scroll up.
- **Expected:** `LargeTopAppBar` collapses on scroll-down and re-expands on scroll-up. Title remains legible.
- **Pass criteria:** No jank, no overlap.
- **iOS reference:** Equivalent SwiftUI behaviour.

### TC-0039 — Expandable section chevron rotates on toggle
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P2
- **Preconditions:** Dashboard collapsible section visible.
- **Steps:**
  1. Tap the section header.
  2. Tap again.
- **Expected:** Chevron rotates 0° -> 180° and back. Content expands/collapses.
- **Pass criteria:** Animation smooth (≥ 60 fps target).
- **iOS reference:** SwiftUI rotating chevron.

### TC-0040 — Empty state when no transactions
- **Area:** Dashboard
- **Type:** UI / Edge
- **Severity:** P1
- **Preconditions:** Brand-new account with zero transactions, zero accounts.
- **Steps:**
  1. Sign up / reset data.
  2. Open Dashboard.
- **Expected:** All KPIs show ₹0 (or "—"). Recent transactions section shows EmptyStateView with CTA "Add your first transaction".
- **Pass criteria:** No crash; CTA opens TransactionFormScreen.
- **iOS reference:** Same expectation.

### TC-0041 — Error state when API fails
- **Area:** Dashboard
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Backend made unreachable (kill local proxy or set DNS to 0.0.0.0).
- **Steps:**
  1. Open Dashboard.
- **Expected:** ErrorBanner shown with retry. No crash. Cached values displayed if available.
- **Pass criteria:** App recovers when network restored.
- **iOS reference:** Same.

### TC-0042 — Dashboard cashflow projection card shown
- **Area:** Dashboard
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Demo account.
- **Steps:**
  1. Scroll to projection card.
- **Expected:** Card shows next-month projected net flow from `GET /api/cashflow/projection`. Tapping it navigates to `Screen.Mandates` (CashFlowScreen).
- **Pass criteria:** Tap navigates correctly.
- **iOS reference:** Cashflow card.

### TC-0043 — Hindi/English toggle on Dashboard top bar
- **Area:** Dashboard / Localization
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Localization implemented.
- **Steps:**
  1. Tap the language toggle in the top app bar.
- **Expected:** UI toggles between English and Hindi. Persists across restart.
- **Pass criteria:** Strings render in chosen language.
- **Known defect:** PARITY MATRIX P1 #30 — Hindi MISSING on Android. Expected: FAIL.
- **iOS reference:** `LocalizationManager.shared` toggle.

---

## C. Transactions

### TC-0044 — TransactionListScreen loads list
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Demo account.
- **Steps:**
  1. Tap Transactions tab.
- **Expected:** First page (~50) of transactions loaded via `GET /api/transactions`. Each row shows date, description, amount, category icon.
- **Pass criteria:** List populated; spinner gone.
- **iOS reference:** `TransactionListView`.

### TC-0045 — Infinite scroll loads next page
- **Area:** Transactions
- **Type:** E2E / Performance
- **Severity:** P0
- **Preconditions:** Account with > 50 transactions.
- **Steps:**
  1. Scroll to last visible row.
  2. Continue to scroll past it.
- **Expected:** `loadMore()` called; next page fetched via `GET /api/transactions?skip=50&limit=50`. New rows appended without flicker.
- **Pass criteria:** Pagination works for at least 3 page-turns.
- **Known defect:** PARITY MATRIX — main-list pagination not explicitly confirmed. Verify.
- **iOS reference:** Same.

### TC-0046 — Search by merchant (debounced)
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Account with txns containing "Amazon" merchant.
- **Steps:**
  1. Tap the search bar.
  2. Type "amaz".
  3. Wait ~300ms (debounce).
- **Expected:** `GET /api/transactions/search?q=amaz` fired exactly once (debounced). Results filtered to merchant "Amazon".
- **Pass criteria:** Single network call after debounce; correct results.
- **iOS reference:** `searchable` modifier debounce.

### TC-0047 — Search call MUST include status=approved
- **Area:** Transactions
- **Type:** Backend
- **Severity:** P0
- **Preconditions:** Account with both pending and approved txns matching query.
- **Steps:**
  1. Search any term.
  2. Inspect network call.
- **Expected:** Search request sent with `status=approved` query parameter, OR results post-filtered to exclude pending.
- **Pass criteria:** No `pending_review` rows appear in main approved list.
- **Known defect:** PARITY MATRIX P0 #13 — Android currently omits `status=approved`. Expected: FAIL until added.
- **iOS reference:** `GET /api/transactions/search?q=&status=approved`.

### TC-0048 — Filter by type chip (Income / Expense / Transfer / All)
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** TransactionListScreen open.
- **Steps:**
  1. Tap "Income" chip.
  2. Tap "Expense" chip.
  3. Tap "All" chip.
- **Expected:** List filters to chosen type. Network refetched or filtered locally.
- **Pass criteria:** Visible rows match filter.
- **iOS reference:** Filter chip bar.

### TC-0049 — Filter by account chip
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Account with txns across multiple accounts.
- **Steps:**
  1. Tap the account filter chip / dropdown.
  2. Select one account.
- **Expected:** List shows only txns linked to that account.
- **Pass criteria:** Account ID matches filter.
- **iOS reference:** Account picker.

### TC-0050 — Filter by date range
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Demo data spanning 6+ months.
- **Steps:**
  1. Tap the date filter button.
  2. In the date dialog, pick from = 30 days ago and to = today.
  3. Tap Apply.
- **Expected:** List filters to that range. Outside-range rows hidden.
- **Pass criteria:** Date range respected.
- **iOS reference:** Date Range popover.

### TC-0051 — View-mode toggle: List vs Ledger
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** TransactionListScreen open.
- **Steps:**
  1. Tap the view-mode toggle.
- **Expected:** Switches to `TransactionLedgerScreen` showing running balance per row.
- **Pass criteria:** Ledger renders; toggling back returns to list.
- **iOS reference:** Segmented Picker view-mode.

### TC-0052 — Long-press enters multi-select mode
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** TransactionListScreen with rows.
- **Steps:**
  1. Long-press a row.
- **Expected:** Selection mode active; checkboxes appear; bulk action bar appears with Delete / Select All / Cancel.
- **Pass criteria:** UI changes; further taps select/deselect.
- **iOS reference:** Long-press selection.

### TC-0053 — Bulk delete selected transactions
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Selection mode active with 3+ rows checked.
- **Steps:**
  1. Tap Delete in the bulk action bar.
  2. Confirm the AlertDialog.
- **Expected:** `POST /api/transactions/bulk-delete` with selected IDs returns 200. Rows removed. Selection mode exited.
- **Pass criteria:** Server count decreases by N; UI matches.
- **iOS reference:** Bulk delete.

### TC-0054 — Select All toggles all rows
- **Area:** Transactions
- **Type:** UI
- **Severity:** P2
- **Preconditions:** Selection mode active.
- **Steps:**
  1. Tap Select All.
  2. Tap Cancel.
- **Expected:** All visible rows checked; Cancel exits selection mode.
- **Pass criteria:** State correct.
- **iOS reference:** Same.

### TC-0055 — Swipe actions: Delete and Edit
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** TransactionListScreen with rows.
- **Steps:**
  1. Swipe a row left.
- **Expected:** Reveals Delete and Edit action buttons.
- **Pass criteria:** Both actions wired.
- **Known defect:** PARITY MATRIX P1 #33 — swipe-to-delete and swipe-to-edit MISSING on Android. Expected: FAIL until added.
- **iOS reference:** TransactionListView swipe actions.

### TC-0056 — Pull-to-refresh on transactions list
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** TransactionListScreen.
- **Steps:**
  1. Drag down.
- **Expected:** Refresh indicator; list refetched.
- **Pass criteria:** New rows appear if added on backend.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** `.refreshable`.

### TC-0057 — Add transaction: income happy path
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** TransactionListScreen.
- **Steps:**
  1. Tap FAB +.
  2. Choose Type = Income.
  3. Enter amount = 5000.
  4. Pick account, category, date.
  5. Type description.
  6. Tap Save.
- **Expected:** `POST /api/transactions` returns 200. Sheet dismisses. New row appears at top.
- **Pass criteria:** Sum of income increases by 5000.
- **iOS reference:** UnifiedTransactionForm.

### TC-0058 — Add transaction: expense happy path
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Same.
- **Steps:** Pick Type = Expense, amount 250, category Food, save.
- **Expected:** Row created, expense KPI on Dashboard increases by 250.
- **Pass criteria:** Same as above.
- **iOS reference:** Same.

### TC-0059 — Add transaction: transfer between accounts
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** At least 2 accounts.
- **Steps:**
  1. Toggle Transfer mode in form.
  2. Pick source account, destination account.
  3. Enter amount 1000, save.
- **Expected:** Two journal entries created (debit/credit). Source balance decreases, destination increases.
- **Pass criteria:** Balances match expectation.
- **iOS reference:** UnifiedTransactionForm transfer mode.

### TC-0060 — Amount field regex validation
- **Area:** Transactions
- **Type:** Negative / Edge
- **Severity:** P1
- **Preconditions:** Form open.
- **Steps:**
  1. Try typing letters into amount.
  2. Try "12.345" (3 decimals).
  3. Try "0".
  4. Try negative "-5".
- **Expected:** Field rejects non-numeric. Limits to 2 decimal places (`^\d*\.?\d{0,2}$`). Negatives not allowed (use type=Expense for outflow).
- **Pass criteria:** Form validation prevents invalid input; Save button disabled while invalid.
- **iOS reference:** Same regex on iOS.

### TC-0061 — Save disabled with empty required fields
- **Area:** Transactions
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Form open, no fields filled.
- **Steps:**
  1. Tap Save without entering amount.
- **Expected:** Save button disabled OR shows inline error "Amount required".
- **Pass criteria:** No request fires; clear error message.
- **iOS reference:** UnifiedTransactionForm validation.

### TC-0062 — Inline +New Account from form
- **Area:** Transactions
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Form open.
- **Steps:**
  1. Open the account picker.
  2. Look for "+ New Account" option.
- **Expected:** Tapping it opens an inline alert/sheet to create an account without leaving the txn form.
- **Pass criteria:** New account appears in picker after creation.
- **Known defect:** PARITY MATRIX P0 #12 — inline +New Account MISSING on Android. Expected: FAIL.
- **iOS reference:** UnifiedTransactionForm inline-create alerts.

### TC-0063 — Inline +New Category from form
- **Area:** Transactions
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Form open.
- **Steps:**
  1. Open category picker.
  2. Look for "+ New Category".
- **Expected:** Inline create alert opens; new category appears in dropdown.
- **Pass criteria:** Same as above.
- **Known defect:** Same MISSING as TC-0062.
- **iOS reference:** UnifiedTransactionForm.

### TC-0064 — Inline +New Subcategory from form
- **Area:** Transactions
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Form open with parent category selected.
- **Steps:**
  1. Open sub-category picker.
  2. Look for "+ New Subcategory".
- **Expected:** Inline create available.
- **Pass criteria:** Sub-category appears after creation.
- **Known defect:** Same MISSING.
- **iOS reference:** UnifiedTransactionForm.

### TC-0065 — Camera capture from transaction form
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Form open. CAMERA permission granted.
- **Steps:**
  1. Tap "Attach receipt" -> Camera.
  2. Capture a photo.
  3. Save txn.
- **Expected:** Image attached. Saved with transaction.
- **Pass criteria:** Receipt visible on detail.
- **Known defect:** PARITY MATRIX P1 — `CameraCaptureView` MISSING from Android txn form. Expected: FAIL.
- **iOS reference:** UnifiedTransactionForm CameraCaptureView.

### TC-0066 — Photo gallery attachment from transaction form
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Form open. READ_MEDIA_IMAGES granted.
- **Steps:**
  1. Tap "Attach receipt" -> Gallery / PhotosPicker.
  2. Choose an image.
  3. Save.
- **Expected:** Image attached.
- **Pass criteria:** Same as above.
- **Known defect:** PhotosPicker attachment MISSING from txn form on Android.
- **iOS reference:** PhotosPicker attachment.

### TC-0067 — Recurring toggle and date in transaction form
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Form open.
- **Steps:**
  1. Toggle "Recurring".
  2. Pick day-of-month (1–31).
  3. Save.
- **Expected:** Recurring section saved with day; appears in CashFlow > Recurring list.
- **Pass criteria:** Server stores recurring metadata.
- **Known defect:** PARITY MATRIX P0 #12 — recurring-date field MISSING on Android.
- **iOS reference:** UnifiedTransactionForm recurring section.

### TC-0068 — Toggle recurring from list row
- **Area:** Transactions
- **Type:** Backend
- **Severity:** P1
- **Preconditions:** A transaction visible.
- **Steps:**
  1. Open detail.
  2. Toggle recurring.
- **Expected:** `POST /api/transactions/{id}/toggle-recurring` 200.
- **Pass criteria:** Endpoint called; UI reflects new state.
- **iOS reference:** Same endpoint.

### TC-0069 — Edit existing transaction
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Existing transaction.
- **Steps:**
  1. Open detail -> Edit.
  2. Change amount from 100 to 150.
  3. Save.
- **Expected:** `PUT /api/transactions/{id}` 200. Detail shows new amount. Dashboard totals reflect change.
- **Pass criteria:** Server updated.
- **iOS reference:** UnifiedTransactionForm edit mode.

### TC-0070 — Delete single transaction from detail
- **Area:** Transactions
- **Type:** E2E / Destructive
- **Severity:** P0
- **Preconditions:** Existing transaction.
- **Steps:**
  1. Open detail -> Delete.
  2. Confirm dialog.
- **Expected:** `DELETE /api/transactions/{id}` 200. Returns to list. Row removed.
- **Pass criteria:** Total count decreases by 1.
- **iOS reference:** TransactionDetailView.

### TC-0071 — Approve pending transaction
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** At least one pending txn.
- **Steps:**
  1. Open PendingReviewScreen (via Dashboard banner).
  2. Tap Approve on a row.
- **Expected:** `POST /api/transactions/{id}/approve` 200. Row leaves list. Approved txn appears in main list and contributes to totals.
- **Pass criteria:** Server status changes from `pending_review` to `approved`.
- **iOS reference:** PendingReviewView.

### TC-0072 — Reject pending transaction
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Pending txn.
- **Steps:**
  1. Tap Reject.
- **Expected:** `POST /api/transactions/{id}/reject` 200. Row removed. Does not appear in approved totals.
- **Pass criteria:** Verified in API.
- **iOS reference:** Same.

### TC-0073 — Bulk approve pending
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** 5+ pending txns.
- **Steps:**
  1. Multi-select 3 rows.
  2. Tap Bulk Approve.
- **Expected:** `POST /api/transactions/bulk-approve` 200 with array of IDs. Selected rows removed.
- **Pass criteria:** Total count drops by 3.
- **iOS reference:** Same.

### TC-0074 — Bulk reject pending
- **Area:** Transactions
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Same.
- **Steps:** Multi-select 3 -> Bulk Reject.
- **Expected:** `POST /api/transactions/bulk-reject` 200.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0075 — Inline create-account / category / subcategory in PendingReview approval
- **Area:** Transactions
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Pending txn whose AI-suggested category does not exist.
- **Steps:**
  1. Tap Edit on the pending row.
  2. Open category picker.
- **Expected:** "+ New Category" option present; lets user create without bailing out.
- **Pass criteria:** Inline creation works.
- **Known defect:** PARITY MATRIX P0 #15 — Android does NOT surface inline create alerts in PendingReviewScreen. Expected: FAIL.
- **iOS reference:** PendingReviewView inline-create alerts.

### TC-0076 — Switch between Pending / Approved / All tabs
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Account with both pending and approved.
- **Steps:**
  1. Tap each filter tab/chip.
- **Expected:** List populates correctly. Pending tab pulls from `GET /api/transactions/pending`; Approved from `GET /api/transactions?status=approved`.
- **Pass criteria:** Counts match server.
- **iOS reference:** Filter chip bar.

### TC-0077 — Source document viewer on transaction detail
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Email-sourced transaction.
- **Steps:**
  1. Open detail.
  2. Look for "View source email/document" link.
- **Expected:** Tap opens HTML email or PDF source via `GET /api/source/{id}` (or `GET /api/email/source/{id}`).
- **Pass criteria:** Source content rendered.
- **Known defect:** PARITY MATRIX — source-document expansion MISSING on Android `TransactionDetailScreen`. Expected: FAIL.
- **iOS reference:** TransactionDetailView source expansion.

### TC-0078 — Attachment list on transaction detail
- **Area:** Transactions
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Transaction with attached image.
- **Steps:**
  1. Open detail.
- **Expected:** Attachments section visible with thumbnails. Tap opens preview via OS-native viewer (or in-app preview).
- **Pass criteria:** Preview renders.
- **Known defect:** PARITY MATRIX — `AttachmentPreviewView` equivalent MISSING on Android.
- **iOS reference:** QuickLook.

### TC-0079 — TransactionLedgerScreen running balance correctness
- **Area:** Transactions
- **Type:** Backend
- **Severity:** P1
- **Preconditions:** Account with 10+ ordered transactions.
- **Steps:**
  1. Switch to ledger view, scope to one account.
  2. Read running balance column.
- **Expected:** Each row's running balance equals sum of all prior txns + this row.
- **Pass criteria:** Balance math correct.
- **iOS reference:** TransactionLedgerView.

### TC-0080 — Empty state on transactions list
- **Area:** Transactions
- **Type:** UI / Edge
- **Severity:** P1
- **Preconditions:** Fresh account, zero txns.
- **Steps:**
  1. Open Transactions tab.
- **Expected:** EmptyStateView with "Add Transaction" CTA. No spinner.
- **Pass criteria:** CTA opens form.
- **iOS reference:** Same.

### TC-0081 — Error state on transactions list
- **Area:** Transactions
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Network down.
- **Steps:**
  1. Open Transactions tab.
- **Expected:** Error AlertDialog with retry. No crash.
- **Pass criteria:** Retry restores once network back.
- **iOS reference:** Same.

### TC-0082 — Date filter dialog reset
- **Area:** Transactions
- **Type:** UI
- **Severity:** P2
- **Preconditions:** Filter applied.
- **Steps:**
  1. Reopen date filter.
  2. Tap Clear.
- **Expected:** Filter cleared; list shows all.
- **Pass criteria:** Filter chip removed.
- **iOS reference:** Same.

### TC-0083 — Concurrent edits: Android edits vs web
- **Area:** Transactions
- **Type:** Edge / Negative
- **Severity:** P1
- **Preconditions:** Same txn open on Android and on web.
- **Steps:**
  1. Edit on Android, save.
  2. Edit different field on web, save.
  3. Pull-to-refresh on Android.
- **Expected:** Last write wins or backend returns 409. UI shows up-to-date data.
- **Pass criteria:** No data corruption.
- **iOS reference:** N/A.

### TC-0084 — Very long description string
- **Area:** Transactions
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Form open.
- **Steps:**
  1. Type a 500-char description.
  2. Save.
- **Expected:** Either accepted, or truncated with clear feedback.
- **Pass criteria:** No crash; field handles overflow.
- **iOS reference:** Same.

### TC-0085 — Future date acceptance
- **Area:** Transactions
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Form open.
- **Steps:**
  1. Pick a date 30 days in the future.
  2. Save.
- **Expected:** Allowed (treated as scheduled). Or rejected with clear message if business rule disallows.
- **Pass criteria:** Behaviour consistent with spec.
- **iOS reference:** Same.

---

## D. Accounts

### TC-0086 — AccountListScreen loads with totals
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Demo account.
- **Steps:**
  1. Tap Accounts tab.
- **Expected:** All accounts loaded via `GET /api/accounts`. Total balance card visible.
- **Pass criteria:** Sum equals API response total.
- **iOS reference:** AccountListView.

### TC-0087 — Search accounts
- **Area:** Accounts
- **Type:** UI
- **Severity:** P1
- **Preconditions:** AccountListScreen.
- **Steps:**
  1. Look for search field.
- **Expected:** Search field visible; typing filters list by name.
- **Pass criteria:** Filter works.
- **Known defect:** PARITY MATRIX — search MISSING on Android AccountListScreen.
- **iOS reference:** `searchable`.

### TC-0088 — Pull-to-refresh accounts
- **Area:** Accounts
- **Type:** UI
- **Severity:** P1
- **Preconditions:** AccountListScreen.
- **Steps:**
  1. Drag down.
- **Expected:** Refetch.
- **Pass criteria:** Same as Dashboard.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** Same.

### TC-0089 — Create account: Bank type
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** AccountListScreen.
- **Steps:**
  1. Tap FAB +.
  2. Pick sub-type "Savings" (Bank).
  3. Enter name "HDFC Savings", account number, currency INR.
  4. Save.
- **Expected:** `POST /api/accounts` 200. Row appears.
- **Pass criteria:** Server has new account.
- **iOS reference:** AccountFormView.

### TC-0090 — Create account: Credit card
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Same.
- **Steps:** Sub-type Credit Card; name "Axis Magnus"; save.
- **Expected:** Row created with credit-card icon.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0091 — Create account: Cash
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Same.
- **Steps:** Sub-type Cash; name "Wallet"; save.
- **Expected:** Row created.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0092 — Create account: Wallet (UPI / Paytm)
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Same.
- **Steps:** Sub-type Wallet; name "Paytm"; save.
- **Expected:** Row created.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0093 — Create account: Loan
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Same.
- **Steps:** Sub-type Loan; name "HDFC Home Loan"; save.
- **Expected:** Loan account created. Amortization tab available on detail.
- **Pass criteria:** `GET /api/accounts/{id}/amortization` 200 from detail.
- **iOS reference:** Same.

### TC-0094 — Create account: Investment / Demat
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Same.
- **Steps:** Sub-type Demat; name "Zerodha"; broker = Zerodha; save.
- **Expected:** Account created. DematUpload screen reachable.
- **Pass criteria:** Broker field saved.
- **iOS reference:** Same.

### TC-0095 — Opening balance + as-of date on form
- **Area:** Accounts
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Form open.
- **Steps:**
  1. Look for Opening Balance amount + as-of date fields.
- **Expected:** Both fields present.
- **Pass criteria:** Saved values reflect on detail.
- **Known defect:** PARITY MATRIX P1 #36 — opening balance + as-of date MISSING on Android. Expected: FAIL.
- **iOS reference:** AccountFormView.

### TC-0096 — Edit account
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Existing account.
- **Steps:**
  1. Open detail -> Edit.
  2. Change name -> Save.
- **Expected:** `PUT /api/accounts/{id}` 200. Name updated.
- **Pass criteria:** UI reflects.
- **iOS reference:** Same.

### TC-0097 — Delete account
- **Area:** Accounts
- **Type:** E2E / Destructive
- **Severity:** P0
- **Preconditions:** Account with no txns or test account.
- **Steps:**
  1. Detail -> Delete.
  2. Confirm.
- **Expected:** `DELETE /api/accounts/{id}` 200. Row gone.
- **Pass criteria:** Deletion succeeds; if has txns, error message.
- **iOS reference:** AccountListView swipe Delete.

### TC-0098 — Recalculate balance
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Account with txns.
- **Steps:**
  1. Detail -> Recalculate.
- **Expected:** `POST /api/accounts/{id}/recalculate` 200. Balance updated to correct value.
- **Pass criteria:** Balance matches sum of transactions.
- **iOS reference:** Same.

### TC-0099 — Inline opening-balance edit on detail
- **Area:** Accounts
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Account detail open.
- **Steps:**
  1. Tap balance to enter edit mode.
  2. Type new value -> Save.
- **Expected:** New value persisted; recalc may run.
- **Pass criteria:** Detail shows new balance.
- **iOS reference:** AccountDetailView Save & Recalculate.

### TC-0100 — AccountDetail Transactions tab
- **Area:** Accounts
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Account with txns.
- **Steps:**
  1. Open detail.
  2. View transaction history list.
- **Expected:** `GET /api/accounts/{id}/transactions` returns ordered list.
- **Pass criteria:** Rows shown.
- **iOS reference:** AccountDetailView Transactions tab.

### TC-0101 — Amortization tab on loan account
- **Area:** Accounts
- **Type:** Backend
- **Severity:** P1
- **Preconditions:** Loan account.
- **Steps:**
  1. Open loan account detail.
- **Expected:** Amortization schedule fetched via `GET /api/accounts/{id}/amortization`. Renders monthly principal + interest.
- **Pass criteria:** Schedule visible.
- **iOS reference:** Amortization tab.

### TC-0102 — OD Interest tab on overdraft account
- **Area:** Accounts
- **Type:** UI
- **Severity:** P1
- **Preconditions:** OD account.
- **Steps:**
  1. Open detail.
  2. Switch to OD Interest tab.
  3. Pick from/to dates.
- **Expected:** `GET /api/accounts/{id}/od-interest` 200.
- **Pass criteria:** OD interest computed and displayed.
- **Known defect:** PARITY MATRIX P1 #35 — OD Interest tab and date pickers MISSING on Android UI (endpoint wired). Expected: FAIL.
- **iOS reference:** OD Interest tab.

### TC-0103 — Demat tab embedded vs separate route
- **Area:** Accounts
- **Type:** UI
- **Severity:** P2
- **Preconditions:** Demat account.
- **Steps:**
  1. Open detail.
- **Expected:** Demat tab inline (iOS-parity) or DematUploadScreen reachable.
- **Pass criteria:** UI present.
- **Known defect:** PARITY MATRIX P1 #35 — Android uses separate DematUploadScreen. Acceptable but flagged.
- **iOS reference:** Demat tab.

### TC-0104 — Demat upload statement
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Demat account.
- **Steps:**
  1. Open DematUploadScreen.
  2. Tap upload card.
  3. Pick a PDF.
  4. Submit.
- **Expected:** `POST /api/demat/upload-statement` 200. Statement appears in pending list.
- **Pass criteria:** Server confirms upload.
- **iOS reference:** DematUploadView.

### TC-0105 — Approve demat statement
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Pending demat statement.
- **Steps:**
  1. Tap Approve on a row.
  2. Confirm.
- **Expected:** `POST /api/demat/approve-statement/{id}` 200. Row moves to historical.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0106 — Reject demat statement
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Pending demat.
- **Steps:** Reject + confirm.
- **Expected:** `POST /api/demat/reject-statement/{id}` 200.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0107 — SubTypeManager CRUD
- **Area:** Accounts
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Reachable via gear icon on AccountListScreen.
- **Steps:**
  1. Open SubTypeManagerScreen.
  2. Add sub-type "HDFC Salary".
  3. Edit it inline.
  4. Delete it.
- **Expected:** `POST /api/account-sub-types`, `PUT`, `DELETE` 200.
- **Pass criteria:** Round-trip works; deletion confirmed.
- **iOS reference:** SubTypeManagerView.

### TC-0108 — Account form name validation
- **Area:** Accounts
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Form open with empty name.
- **Steps:**
  1. Tap Save.
- **Expected:** Save disabled OR shows "Name required".
- **Pass criteria:** Validation enforced.
- **iOS reference:** Same.

### TC-0109 — Empty state on accounts list
- **Area:** Accounts
- **Type:** UI / Edge
- **Severity:** P1
- **Preconditions:** Fresh account.
- **Steps:**
  1. Open Accounts tab.
- **Expected:** EmptyStateView with "Add Account" CTA.
- **Pass criteria:** CTA opens form.
- **iOS reference:** Same.

### TC-0110 — Currency picker depth
- **Area:** Accounts
- **Type:** UI
- **Severity:** P2
- **Preconditions:** Form open.
- **Steps:**
  1. Open currency picker.
- **Expected:** Lists 10+ currencies (INR, USD, EUR, GBP, AED, SGD, AUD, CAD, JPY, etc.) matching iOS.
- **Pass criteria:** Same set as iOS.
- **iOS reference:** AccountFormView currency picker.

---

## E. CashFlow / Mandates / Recurring

### TC-0111 — CashFlowScreen loads with projection chart
- **Area:** CashFlow
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Demo account; mandates seeded.
- **Steps:**
  1. More -> Cash Flow.
- **Expected:** `GET /api/cashflow/projection` and `/api/cashflow/history` return 200. 24-month chart visible.
- **Pass criteria:** Chart displays with both past and future bars/lines.
- **Known defect:** PARITY MATRIX P2 #47 — verify a 24-month chart parity with iOS.
- **iOS reference:** CashFlowChartView.

### TC-0112 — Drill-down: Income card
- **Area:** CashFlow
- **Type:** UI
- **Severity:** P1
- **Preconditions:** CashFlow open.
- **Steps:**
  1. Tap Income drill-down stat card.
- **Expected:** `CashFlowDrillDownSheet` opens with income breakdown.
- **Pass criteria:** Sheet shown.
- **iOS reference:** CashFlowDrillDownSheet.

### TC-0113 — Drill-down: Expense card
- **Area:** CashFlow
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap Expense card.
- **Expected:** Drill-down sheet shows expense breakdown.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0114 — Drill-down: OD Interest card
- **Area:** CashFlow
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap OD Interest card.
- **Expected:** Drill-down sheet shows OD interest entries.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0115 — Drill-down: EMI card
- **Area:** CashFlow
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap EMI card.
- **Expected:** Drill-down sheet shows scheduled EMIs from mandates.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0116 — Monthly calendar sheet
- **Area:** CashFlow
- **Type:** UI
- **Severity:** P1
- **Preconditions:** CashFlow open.
- **Steps:**
  1. Tap "Next Month" button.
- **Expected:** `MonthlyCalendarSheet` opens. Each day shows expected inflows/outflows. Read-only.
- **Pass criteria:** Calendar populated.
- **iOS reference:** MonthlyCalendarView.

### TC-0117 — Recurring items list
- **Area:** CashFlow
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Recurring txns seeded.
- **Steps:**
  1. Scroll to Recurring section.
- **Expected:** `GET /api/recurring/list` returns rows. Toggle per-row works.
- **Pass criteria:** Toggle calls `POST /api/transactions/{id}/toggle-recurring`.
- **iOS reference:** RecurringListView.

### TC-0118 — Mandates list screen exists
- **Area:** CashFlow / Mandates
- **Type:** UI
- **Severity:** P1
- **Preconditions:** More menu open.
- **Steps:**
  1. Look for Mandates / Obligations row in More menu.
- **Expected:** Mandates entry visible.
- **Pass criteria:** Entry tappable.
- **Known defect:** PARITY MATRIX P1 #22 — Mandates UI MISSING on Android. Expected: FAIL.
- **iOS reference:** MandatesListView.

### TC-0119 — Detect mandates from emails
- **Area:** CashFlow / Mandates
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Gmail connected with mandate-style emails (NACH, autopay).
- **Steps:**
  1. Tap Detect Mandates button.
- **Expected:** `POST /api/mandates/detect` 200. New mandates shown in list.
- **Pass criteria:** At least one mandate detected.
- **Known defect:** Same MISSING.
- **iOS reference:** MandatesListView Detect button.

### TC-0120 — Mandate edit modal — every field
- **Area:** Mandates
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Mandate exists.
- **Steps:**
  1. Tap a mandate row.
  2. Edit name, amount, day-of-month, account, category.
  3. Save.
- **Expected:** `PATCH /api/mandates/{id}` 200.
- **Pass criteria:** Updated fields persisted.
- **Known defect:** Mandates UI MISSING.
- **iOS reference:** Mandate edit sheet.

### TC-0121 — Mandate source-document viewer
- **Area:** Mandates
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Mandate detected from email.
- **Steps:**
  1. Open mandate -> View source.
- **Expected:** Source email rendered.
- **Pass criteria:** Renders.
- **Known defect:** Mandates UI MISSING.
- **iOS reference:** MandatesListView source sheet.

### TC-0122 — Pause / resume mandate
- **Area:** Mandates
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Active mandate.
- **Steps:**
  1. Toggle Pause.
- **Expected:** Mandate marked paused; not included in projection until resumed.
- **Pass criteria:** Projection chart updates.
- **Known defect:** Mandates UI MISSING.
- **iOS reference:** Same.

### TC-0123 — Delete mandate
- **Area:** Mandates
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Mandate exists.
- **Steps:** Delete + confirm.
- **Expected:** `DELETE /api/mandates/{id}/delete` 200. Removed.
- **Pass criteria:** Same.
- **Known defect:** Mandates UI MISSING.
- **iOS reference:** Same.

### TC-0124 — Create mandate manually
- **Area:** Mandates
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Mandate UI present.
- **Steps:** + -> form -> save.
- **Expected:** `POST /api/mandates/create` 200.
- **Pass criteria:** Row appears.
- **Known defect:** Mandates UI MISSING.
- **iOS reference:** Same.

### TC-0125 — Pull-to-refresh on CashFlow
- **Area:** CashFlow
- **Type:** UI
- **Severity:** P2
- **Steps:** Drag down.
- **Expected:** Refetch.
- **Pass criteria:** Same as Dashboard.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** Same.

### TC-0126 — Empty state on CashFlow (no recurring, no mandates)
- **Area:** CashFlow
- **Type:** UI / Edge
- **Severity:** P2
- **Preconditions:** Fresh account.
- **Steps:** Open CashFlow.
- **Expected:** Empty messaging in projection + recurring list. No crash.
- **Pass criteria:** Same.
- **iOS reference:** Same.

---

## F. Reports

### TC-0127 — Reports tab loads summary
- **Area:** Reports
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Demo account.
- **Steps:**
  1. Tap Reports tab.
- **Expected:** `GET /api/reports/summary` returns totals. Income/expense KPIs visible.
- **Pass criteria:** Numbers match server.
- **iOS reference:** ReportsView.

### TC-0128 — Period preset chip: Week
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap "Week" chip.
- **Expected:** Reports refilter to last 7 days. `GET /api/reports/by-period?range=week` (or equivalent param).
- **Pass criteria:** Chart updates.
- **iOS reference:** Period preset pills.

### TC-0129 — Period preset: Month
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap Month.
- **Expected:** Last 30 days.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0130 — Period preset: Quarter
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap Quarter.
- **Expected:** Last 3 months.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0131 — Period preset: Year
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap Year.
- **Expected:** Last 12 months.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0132 — Custom date range pickers
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Reports open.
- **Steps:**
  1. Tap Custom preset.
  2. Pick start/end.
- **Expected:** Date pickers appear; report regenerates.
- **Pass criteria:** Custom range respected.
- **Known defect:** PARITY MATRIX P1 #25 — custom date pickers MISSING on Android. Expected: FAIL.
- **iOS reference:** Custom DatePickers.

### TC-0133 — Donut chart by-category
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Reports open.
- **Steps:**
  1. Scroll to donut chart.
- **Expected:** `GET /api/reports/by-category` populates chart. Slices proportional to amounts.
- **Pass criteria:** Slice sizes match data.
- **iOS reference:** DonutChartView.

### TC-0134 — Donut chart slice tap drill-down
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap a slice.
- **Expected:** Opens drill-down sheet listing transactions in that category.
- **Pass criteria:** Sheet shown.
- **Known defect:** PARITY MATRIX P1 #24 — drill-down sheet MISSING on Android. Expected: FAIL.
- **iOS reference:** ReportTransactionsView.

### TC-0135 — Period chart (line/bar)
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Steps:** Scroll to period chart.
- **Expected:** `GET /api/reports/by-period` data plotted.
- **Pass criteria:** Chart renders.
- **iOS reference:** PeriodChartView.

### TC-0136 — Income vs expense card
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Reports open.
- **Steps:**
  1. Read income vs expense KPI / card.
- **Expected:** `GET /api/reports/income-expense` populates.
- **Pass criteria:** Net = income - expense.
- **iOS reference:** Same.

### TC-0137 — Account report (per-account breakdown)
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Steps:**
  1. Look for per-account breakdown.
- **Expected:** Per-account totals visible (or filter by account).
- **Pass criteria:** Breakdown shown or accessible.
- **iOS reference:** Same.

### TC-0138 — Expandable category table
- **Area:** Reports
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap category row to expand.
- **Expected:** Expands to show subcategories or txn list.
- **Pass criteria:** Animation works.
- **iOS reference:** Same.

### TC-0139 — Export CSV
- **Area:** Reports
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Reports open.
- **Steps:**
  1. Look for "Export CSV" button.
  2. Tap it.
- **Expected:** `GET /api/reports/export/csv` returns file. Saved to Downloads or shared via system sheet.
- **Pass criteria:** CSV opens in spreadsheet app.
- **Known defect:** PARITY MATRIX P1 #26 — Export CSV button MISSING on Android UI. Expected: FAIL.
- **iOS reference:** Export CSV button.

### TC-0140 — Export PDF
- **Area:** Reports
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Reports open.
- **Steps:**
  1. Tap "Export PDF".
- **Expected:** `GET /api/reports/export/pdf` returns file. Shared via Intent.ACTION_SEND.
- **Pass criteria:** PDF opens in viewer.
- **Known defect:** Same as TC-0139.
- **iOS reference:** Export PDF button.

### TC-0141 — Refresh icon on Reports
- **Area:** Reports
- **Type:** UI
- **Severity:** P2
- **Steps:** Tap refresh IconButton.
- **Expected:** All reports refetched.
- **Pass criteria:** Spinner brief; new data.
- **iOS reference:** Same.

### TC-0142 — Pull-to-refresh on Reports
- **Area:** Reports
- **Type:** UI
- **Severity:** P2
- **Steps:** Drag down.
- **Expected:** Refetch.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #34 — Reports pull-to-refresh MISSING.
- **iOS reference:** `.refreshable`.

### TC-0143 — Reports excludes pending transactions
- **Area:** Reports
- **Type:** Backend
- **Severity:** P0
- **Preconditions:** Pending + approved txns.
- **Steps:**
  1. Open Reports.
- **Expected:** Pending txns NOT included in any chart or KPI.
- **Pass criteria:** Per `feedback_pending_transactions.md`.
- **iOS reference:** Same rule.

### TC-0144 — Empty state on Reports
- **Area:** Reports
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Account with no txns.
- **Steps:** Open Reports.
- **Expected:** Friendly empty state, not blank charts.
- **Pass criteria:** Empty messaging visible.
- **iOS reference:** Same.

### TC-0145 — Error state on Reports
- **Area:** Reports
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Network down.
- **Steps:** Open Reports.
- **Expected:** Error AlertDialog with retry.
- **Pass criteria:** No crash.
- **iOS reference:** Same.

---

## G. Customers

### TC-0146 — CustomerListScreen loads
- **Area:** Customers
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Demo account.
- **Steps:** More -> Customers.
- **Expected:** `GET /api/customers` returns list.
- **Pass criteria:** Rows shown.
- **iOS reference:** CustomerListView.

### TC-0147 — Search customers
- **Area:** Customers
- **Type:** UI
- **Severity:** P1
- **Steps:**
  1. Type "Acme" in search field.
- **Expected:** List filters.
- **Pass criteria:** Same.
- **iOS reference:** searchable.

### TC-0148 — Create customer (name + email + phone + GSTIN + billing address)
- **Area:** Customers
- **Type:** E2E
- **Severity:** P1
- **Steps:**
  1. FAB +.
  2. Fill all fields.
  3. Save.
- **Expected:** `POST /api/customers` 200. Row appears.
- **Pass criteria:** Server has new customer.
- **iOS reference:** CustomerFormView (without GSTIN — Android richer).

### TC-0149 — Customer email format validation
- **Area:** Customers
- **Type:** Negative
- **Severity:** P1
- **Steps:**
  1. Enter "not-an-email".
  2. Try to Save.
- **Expected:** Inline error "Invalid email".
- **Pass criteria:** Save blocked.
- **iOS reference:** Same.

### TC-0150 — Edit customer
- **Area:** Customers
- **Type:** E2E
- **Severity:** P1
- **Steps:** Open detail -> Edit -> change phone -> Save.
- **Expected:** `PUT /api/customers/{id}` 200.
- **Pass criteria:** Updated.
- **iOS reference:** Same.

### TC-0151 — Delete customer
- **Area:** Customers
- **Type:** E2E / Destructive
- **Severity:** P1
- **Steps:** Detail -> Delete -> confirm.
- **Expected:** `DELETE /api/customers/{id}` 200.
- **Pass criteria:** Removed.
- **iOS reference:** Same.

### TC-0152 — Swipe-to-delete on customer list
- **Area:** Customers
- **Type:** UI
- **Severity:** P2
- **Steps:** Swipe a row left.
- **Expected:** Delete action revealed.
- **Pass criteria:** Action works.
- **Known defect:** PARITY MATRIX — swipe-to-delete MISSING on Android.
- **iOS reference:** `onDelete` swipe.

### TC-0153 — CustomerDetail shows outstanding balance
- **Area:** Customers
- **Type:** Backend
- **Severity:** P1
- **Steps:** Open detail.
- **Expected:** Outstanding balance card visible (sum of unpaid invoices).
- **Pass criteria:** Math correct.
- **iOS reference:** Same.

### TC-0154 — CustomerDetail shows invoices filtered by customer
- **Area:** Customers
- **Type:** UI
- **Severity:** P1
- **Steps:** Scroll to invoices section.
- **Expected:** `GET /api/invoices?customer_id=...` populates.
- **Pass criteria:** Only this customer's invoices shown.
- **iOS reference:** Same.

### TC-0155 — Empty state on customers list
- **Area:** Customers
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Fresh account.
- **Steps:** Open list.
- **Expected:** "Add Customer" CTA.
- **Pass criteria:** CTA opens form.
- **iOS reference:** Same.

### TC-0156 — Pull-to-refresh on customers
- **Area:** Customers
- **Type:** UI
- **Severity:** P2
- **Steps:** Drag down.
- **Expected:** Refetch.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** Same.

---

## H. Vendors

### TC-0157 — VendorListScreen loads
- **Area:** Vendors
- **Type:** E2E
- **Severity:** P1
- **Steps:** More -> Vendors.
- **Expected:** `GET /api/vendors` 200.
- **Pass criteria:** Rows shown.
- **iOS reference:** VendorListView.

### TC-0158 — Search vendors
- **Area:** Vendors
- **Type:** UI
- **Severity:** P1
- **Steps:** Type query.
- **Expected:** Filter.
- **Pass criteria:** Same as customers.
- **iOS reference:** Same.

### TC-0159 — Create vendor
- **Area:** Vendors
- **Type:** E2E
- **Severity:** P1
- **Steps:** FAB + -> fill -> save.
- **Expected:** `POST /api/vendors` 200.
- **Pass criteria:** Row appears.
- **iOS reference:** VendorFormView.

### TC-0160 — Edit vendor
- **Area:** Vendors
- **Type:** E2E
- **Severity:** P1
- **Steps:** Detail -> Edit -> Save.
- **Expected:** `PUT /api/vendors/{id}` 200.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0161 — Delete vendor
- **Area:** Vendors
- **Type:** E2E / Destructive
- **Severity:** P1
- **Steps:** Detail -> Delete.
- **Expected:** `DELETE /api/vendors/{id}` 200.
- **Pass criteria:** Removed.
- **iOS reference:** Same.

### TC-0162 — VendorDetail shows bills filtered by vendor
- **Area:** Vendors
- **Type:** UI
- **Severity:** P1
- **Steps:** Open detail.
- **Expected:** `GET /api/bills?vendor_id=...` populates.
- **Pass criteria:** Vendor-scoped bills shown.
- **iOS reference:** Same.

### TC-0163 — Swipe-to-delete on vendor list
- **Area:** Vendors
- **Type:** UI
- **Severity:** P2
- **Steps:** Swipe row.
- **Expected:** Delete action.
- **Pass criteria:** Action works.
- **Known defect:** Swipe MISSING.
- **iOS reference:** Same.

---

## I. Invoices

### TC-0164 — InvoiceListScreen loads
- **Area:** Invoices
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Demo account.
- **Steps:** More -> Invoices.
- **Expected:** `GET /api/invoices` 200; status filter chips visible.
- **Pass criteria:** Rows shown.
- **iOS reference:** InvoiceListView.

### TC-0165 — Status filter chips: All / Draft / Sent / Paid / Overdue
- **Area:** Invoices
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap each chip.
- **Expected:** List filters by status.
- **Pass criteria:** Filter applied.
- **iOS reference:** Same.

### TC-0166 — Stats card: total receivables / outstanding / aging
- **Area:** Invoices
- **Type:** Backend
- **Severity:** P1
- **Steps:** Open list.
- **Expected:** Stats card visible at top with totals from `/api/invoices/stats`, `/count`, `/debtors`, `/aging`.
- **Pass criteria:** Numbers match server.
- **Known defect:** PARITY MATRIX P1 #16 — stats / debtors / aging cards MISSING on Android. Expected: FAIL.
- **iOS reference:** InvoiceListView stats card.

### TC-0167 — Debtors and aging sections
- **Area:** Invoices
- **Type:** Backend
- **Severity:** P1
- **Steps:** Scroll to debtors / aging.
- **Expected:** Top debtors + aging buckets (0-30, 31-60, 61-90, 90+) shown.
- **Pass criteria:** Same.
- **Known defect:** Same.
- **iOS reference:** Debtors / aging.

### TC-0168 — Search invoices
- **Area:** Invoices
- **Type:** UI
- **Severity:** P1
- **Steps:** Type query.
- **Expected:** List filtered by invoice number / customer.
- **Pass criteria:** Same.
- **Known defect:** Search MISSING on Android.
- **iOS reference:** searchable.

### TC-0169 — Auto-numbering on new invoice
- **Area:** Invoices
- **Type:** Backend
- **Severity:** P1
- **Preconditions:** Open new invoice form.
- **Steps:**
  1. Open form.
- **Expected:** Invoice # pre-filled via `GET /api/invoices/next-number`.
- **Pass criteria:** Number prefilled.
- **Known defect:** PARITY MATRIX P1 #21 — auto-numbering not wired.
- **iOS reference:** Same endpoint.

### TC-0170 — Create invoice with line items
- **Area:** Invoices
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Form open.
- **Steps:**
  1. Pick customer.
  2. Pick issue date / due date.
  3. Add 2 line items (description, qty, price, HSN).
  4. Save.
- **Expected:** `POST /api/invoices` 200. Row appears.
- **Pass criteria:** Server has new invoice with line items.
- **iOS reference:** InvoiceFormView.

### TC-0171 — GST: CGST + SGST split (intra-state)
- **Area:** Invoices
- **Type:** Backend
- **Severity:** P0
- **Preconditions:** Customer same state as user.
- **Steps:**
  1. Add line item with GST 18%.
  2. Save.
- **Expected:** Tax split into 9% CGST + 9% SGST. Totals correct.
- **Pass criteria:** PDF preview shows two columns.
- **iOS reference:** Same.

### TC-0172 — GST: IGST (inter-state)
- **Area:** Invoices
- **Type:** Backend
- **Severity:** P0
- **Preconditions:** Customer in different state.
- **Steps:** Add line item with GST 18%; save.
- **Expected:** Tax shown as 18% IGST single column.
- **Pass criteria:** Server stores correctly.
- **iOS reference:** Same.

### TC-0173 — HSN code on line item
- **Area:** Invoices
- **Type:** UI
- **Severity:** P1
- **Steps:** Add HSN code "9985".
- **Expected:** Saved with line item; visible on PDF.
- **Pass criteria:** Round-trip correct.
- **iOS reference:** Same.

### TC-0174 — Logo on invoice PDF
- **Area:** Invoices
- **Type:** Backend
- **Severity:** P1
- **Preconditions:** User uploaded logo in Settings.
- **Steps:**
  1. Generate invoice PDF preview.
- **Expected:** Logo embedded in header.
- **Pass criteria:** Logo visible.
- **Known defect:** Settings logo upload is placeholder on Android — see Settings TCs. Until upload works, this fails.
- **iOS reference:** Same.

### TC-0175 — Email invoice to customer
- **Area:** Invoices
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Invoice with customer email.
- **Steps:**
  1. Open preview.
  2. Tap Send.
- **Expected:** `POST /api/invoices/{id}/send` 200. Customer receives email.
- **Pass criteria:** Server confirms delivery.
- **iOS reference:** N/A — Android-richer here.

### TC-0176 — Mark invoice as paid (full)
- **Area:** Invoices
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Unpaid invoice.
- **Steps:**
  1. Preview -> Mark Paid.
- **Expected:** Backend records full payment. Status -> Paid.
- **Pass criteria:** Status updates.
- **iOS reference:** Same action.

### TC-0177 — Record partial payment
- **Area:** Invoices
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Unpaid invoice for ₹10,000.
- **Steps:**
  1. Preview -> Record Payment.
  2. Enter ₹3,000, account, date.
  3. Save.
- **Expected:** `POST /api/invoices/{id}/record-payment` 200 with partial. Outstanding ₹7,000.
- **Pass criteria:** Partial recorded; status remains "Partial" / "Sent".
- **Known defect:** PARITY MATRIX CRITICAL #7 — Android currently uses `mark-paid` which loses partial payments. Expected: FAIL until endpoint switched to `record-payment`.
- **iOS reference:** RecordPaymentView.

### TC-0178 — Duplicate invoice
- **Area:** Invoices
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Existing invoice.
- **Steps:**
  1. Preview -> Duplicate.
- **Expected:** `POST /api/invoices/{id}/duplicate` 200. New draft invoice with same line items, new number.
- **Pass criteria:** New row visible.
- **Known defect:** PARITY MATRIX P1 #20 — Duplicate MISSING on Android.
- **iOS reference:** InvoicePreviewView Duplicate.

### TC-0179 — InvoicePreview PDF render
- **Area:** Invoices
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Invoice exists.
- **Steps:** Open preview.
- **Expected:** PDF rendered via `GET /api/invoices/{id}/pdf` and shown via Compose PDF viewer or AndroidPdfRenderer.
- **Pass criteria:** PDF visible.
- **Known defect:** PARITY MATRIX P1 #18 — PDF preview rendering MISSING on Android.
- **iOS reference:** PDFKit preview.

### TC-0180 — Share invoice PDF via system sheet
- **Area:** Invoices
- **Type:** UI
- **Severity:** P1
- **Steps:** Preview -> Share.
- **Expected:** `Intent.ACTION_SEND` with PDF MIME triggers system chooser.
- **Pass criteria:** Apps like Gmail / Drive appear.
- **Known defect:** PARITY MATRIX P1 #19 — ShareSheet MISSING on Android.
- **iOS reference:** UIActivityViewController.

### TC-0181 — Edit invoice
- **Area:** Invoices
- **Type:** E2E
- **Severity:** P0
- **Steps:**
  1. Preview -> Edit.
  2. Change a line item -> Save.
- **Expected:** `PUT /api/invoices/{id}` 200.
- **Pass criteria:** Updated.
- **iOS reference:** Same.

### TC-0182 — Delete invoice
- **Area:** Invoices
- **Type:** E2E / Destructive
- **Severity:** P0
- **Steps:** Preview -> Delete -> confirm.
- **Expected:** `DELETE /api/invoices/{id}` 200.
- **Pass criteria:** Row removed.
- **iOS reference:** Same.

### TC-0183 — Empty state on invoice list
- **Area:** Invoices
- **Type:** Edge
- **Severity:** P2
- **Steps:** Fresh account.
- **Expected:** "Create Invoice" CTA.
- **Pass criteria:** CTA opens form.
- **iOS reference:** Same.

### TC-0184 — Pull-to-refresh on invoice list
- **Area:** Invoices
- **Type:** UI
- **Severity:** P1
- **Steps:** Drag.
- **Expected:** Refetch.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** Same.

---

## J. Purchases (Bills)

### TC-0185 — PurchaseListScreen loads
- **Area:** Purchases
- **Type:** E2E
- **Severity:** P0
- **Steps:** More -> Purchases.
- **Expected:** `GET /api/bills` 200.
- **Pass criteria:** Rows shown.
- **iOS reference:** PurchaseListView.

### TC-0186 — Status filter chips on purchases
- **Area:** Purchases
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap each status chip.
- **Expected:** List filters.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0187 — Stats / creditors / aging cards
- **Area:** Purchases
- **Type:** Backend
- **Severity:** P1
- **Steps:** Open list.
- **Expected:** Cards visible from `/api/bills/{stats,creditors,aging,purchases-by-vendor}`.
- **Pass criteria:** Numbers match.
- **Known defect:** PARITY MATRIX P1 #17 — MISSING on Android.
- **iOS reference:** PurchaseListView.

### TC-0188 — Auto-numbering on new bill
- **Area:** Purchases
- **Type:** Backend
- **Severity:** P1
- **Steps:** Open new bill form.
- **Expected:** `GET /api/bills/next-number` prefills.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #21.
- **iOS reference:** Same.

### TC-0189 — Create bill (line items + GST)
- **Area:** Purchases
- **Type:** E2E
- **Severity:** P0
- **Steps:**
  1. FAB +.
  2. Pick vendor, dates, line items.
  3. Save.
- **Expected:** `POST /api/bills` 200.
- **Pass criteria:** Row created.
- **iOS reference:** PurchaseFormView.

### TC-0190 — Edit bill
- **Area:** Purchases
- **Type:** E2E
- **Severity:** P0
- **Steps:** Detail -> Edit -> Save.
- **Expected:** `PUT /api/bills/{id}` 200.
- **Pass criteria:** Updated.
- **iOS reference:** Same.

### TC-0191 — Delete bill
- **Area:** Purchases
- **Type:** E2E / Destructive
- **Severity:** P0
- **Steps:** Detail -> Delete.
- **Expected:** `DELETE /api/bills/{id}` 200.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0192 — Mark bill paid (full)
- **Area:** Purchases
- **Type:** E2E
- **Severity:** P0
- **Steps:** Preview -> Mark Paid.
- **Expected:** `POST /api/bills/{id}/mark-paid` 200.
- **Pass criteria:** Status -> Paid.
- **iOS reference:** Same.

### TC-0193 — Record partial bill payment
- **Area:** Purchases
- **Type:** E2E
- **Severity:** P0
- **Steps:** Preview -> Record Payment, ₹500 of ₹1,500.
- **Expected:** `POST /api/bills/{id}/record-payment` 200; outstanding ₹1,000.
- **Pass criteria:** Partial recorded.
- **Known defect:** PARITY MATRIX CRITICAL #7 — Android uses `mark-paid` losing partial. Expected: FAIL.
- **iOS reference:** RecordBillPaymentView.

### TC-0194 — Duplicate bill
- **Area:** Purchases
- **Type:** E2E
- **Severity:** P1
- **Steps:** Preview -> Duplicate.
- **Expected:** `POST /api/bills/{id}/duplicate` 200.
- **Pass criteria:** New draft.
- **Known defect:** PARITY MATRIX — MISSING.
- **iOS reference:** Same.

### TC-0195 — Bill upload (PDF)
- **Area:** Purchases
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** BillUploadScreen.
- **Steps:**
  1. Tap upload.
  2. Pick a PDF bill.
  3. Submit.
- **Expected:** File uploaded; OCR/parse runs via `POST /api/bills/parse-upload`.
- **Pass criteria:** Parsed bill appears in pending review.
- **Known defect:** PARITY MATRIX P1 #42 — verify Android calls `parse-upload`. If not, parsing doesn't run.
- **iOS reference:** BillUploadParserView.

### TC-0196 — Bill upload via image
- **Area:** Purchases
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** READ_MEDIA_IMAGES granted.
- **Steps:**
  1. Tap upload.
  2. Pick an image.
- **Expected:** Same as PDF.
- **Pass criteria:** Parsed correctly.
- **iOS reference:** Same.

### TC-0197 — PurchasePreview PDF render
- **Area:** Purchases
- **Type:** UI
- **Severity:** P1
- **Steps:** Open preview.
- **Expected:** `GET /api/bills/{id}/pdf` rendered.
- **Pass criteria:** PDF visible.
- **Known defect:** PARITY MATRIX P1 #18 — MISSING.
- **iOS reference:** Same.

### TC-0198 — Share bill PDF via system sheet
- **Area:** Purchases
- **Type:** UI
- **Severity:** P1
- **Steps:** Preview -> Share.
- **Expected:** Intent.ACTION_SEND.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #19.
- **iOS reference:** Same.

### TC-0199 — Pull-to-refresh on bill list
- **Area:** Purchases
- **Type:** UI
- **Severity:** P1
- **Steps:** Drag.
- **Expected:** Refetch.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** Same.

### TC-0200 — Empty state on bill list
- **Area:** Purchases
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Fresh account.
- **Steps:** Open list.
- **Expected:** "Add Bill" / "Upload Bill" CTAs.
- **Pass criteria:** CTA opens form.
- **iOS reference:** Same.

---

## K. Records / Receipts

### TC-0201 — RecordsScreen loads
- **Area:** Records
- **Type:** E2E
- **Severity:** P1
- **Steps:** More -> Records.
- **Expected:** `GET /api/records/list` and `/api/receipts` 200; combined list visible.
- **Pass criteria:** Rows shown.
- **iOS reference:** RecordsView.

### TC-0202 — Segmented Emails / Receipts tabs
- **Area:** Records
- **Type:** UI
- **Severity:** P1
- **Steps:** Look for tab strip.
- **Expected:** Two tabs: Emails (records) and Receipts. Tap each to filter.
- **Pass criteria:** Filtering works.
- **Known defect:** PARITY MATRIX P1 #37 — segmented tabs MISSING on Android (combined view only). Expected: FAIL.
- **iOS reference:** Segmented control.

### TC-0203 — Search records
- **Area:** Records
- **Type:** UI
- **Severity:** P1
- **Steps:** Type query.
- **Expected:** `GET /api/records/search?q=` filters.
- **Pass criteria:** Same.
- **iOS reference:** searchable.

### TC-0204 — Date filter dialog
- **Area:** Records
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap date filter -> pick from/to -> Apply.
- **Expected:** List filters.
- **Pass criteria:** Same.
- **iOS reference:** Date range filter.

### TC-0205 — Amount filter dialog
- **Area:** Records
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap amount filter -> min/max -> Apply.
- **Expected:** List filters.
- **Pass criteria:** Same.
- **iOS reference:** Amount range.

### TC-0206 — Receipt upload via camera
- **Area:** Records
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** CAMERA permission granted.
- **Steps:**
  1. Open RecordsScreen -> upload IconButton.
  2. Choose Camera.
  3. Capture.
- **Expected:** Receipt uploaded; appears in Receipts tab.
- **Pass criteria:** Server confirms.
- **iOS reference:** ReceiptUploadView.

### TC-0207 — Receipt upload via gallery
- **Area:** Records
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** READ_MEDIA_IMAGES granted.
- **Steps:** Same flow but pick from gallery.
- **Expected:** Same result.
- **Pass criteria:** Same.
- **iOS reference:** PhotosPicker.

### TC-0208 — Receipt parse via AI
- **Area:** Records
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Receipt uploaded.
- **Steps:**
  1. Tap parse on a receipt row.
- **Expected:** `POST /api/receipts/{id}/parse` 200; parsed fields shown.
- **Pass criteria:** Fields populated.
- **iOS reference:** Same.

### TC-0209 — Link receipt to transaction
- **Area:** Records
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Receipt + matching txn exist.
- **Steps:**
  1. Open receipt -> Link.
  2. Pick a transaction.
- **Expected:** `POST /api/receipts/{id}/link` 200.
- **Pass criteria:** Link saved.
- **iOS reference:** Link-to-transaction picker.

### TC-0210 — RecordPreview HTML email render
- **Area:** Records
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Email-source record.
- **Steps:** Tap row.
- **Expected:** RecordPreviewScreen renders HTML email body in WebView.
- **Pass criteria:** Email displayed correctly.
- **Known defect:** PARITY MATRIX P1 #38 — verify Android uses real WebView.
- **iOS reference:** WKWebView HTMLView.

### TC-0211 — Record attachments list + download
- **Area:** Records
- **Type:** UI
- **Severity:** P1
- **Steps:** Open preview.
- **Expected:** Attachments listed; tap to download via `GET /api/records/{id}/attachment/{index}`.
- **Pass criteria:** File downloads.
- **iOS reference:** Same.

### TC-0212 — Download .eml export
- **Area:** Records
- **Type:** E2E
- **Severity:** P1
- **Steps:** Preview -> Download .eml.
- **Expected:** `GET /api/records/{id}/download-eml` returns file.
- **Pass criteria:** File saved or shared.
- **Known defect:** PARITY MATRIX P1 #38 — Android only "download", iOS shares as .eml. Verify share via Intent.ACTION_SEND.
- **iOS reference:** Share .eml.

### TC-0213 — Download zip of records
- **Area:** Records
- **Type:** E2E
- **Severity:** P1
- **Steps:** Open RecordsScreen -> "Download zip" button.
- **Expected:** `POST /api/records/download-zip` returns zip.
- **Pass criteria:** Zip saved.
- **Known defect:** PARITY MATRIX P1 #37 — button MISSING on Android (endpoint wired). Expected: FAIL.
- **iOS reference:** Download zip button.

### TC-0214 — Delete record / receipt
- **Area:** Records
- **Type:** E2E / Destructive
- **Severity:** P1
- **Steps:** Long-press / row option -> Delete.
- **Expected:** `DELETE /api/records/{id}` or `/api/receipts/{id}` 200.
- **Pass criteria:** Row removed.
- **iOS reference:** Swipe Delete.

### TC-0215 — Swipe-to-delete on records
- **Area:** Records
- **Type:** UI
- **Severity:** P2
- **Steps:** Swipe row.
- **Expected:** Delete revealed.
- **Pass criteria:** Action works.
- **Known defect:** Swipe MISSING on Android.
- **iOS reference:** Same.

### TC-0216 — Pull-to-refresh on records
- **Area:** Records
- **Type:** UI
- **Severity:** P1
- **Steps:** Drag.
- **Expected:** Refetch each tab.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** Same.

### TC-0217 — View source email (raw)
- **Area:** Records
- **Type:** UI
- **Severity:** P2
- **Steps:** Preview -> View raw / source.
- **Expected:** Raw email source viewer.
- **Pass criteria:** Source shown.
- **iOS reference:** Same.

---

## L. EmailSync / SMS

### TC-0218 — EmailSyncScreen loads sync status
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P0
- **Steps:** More -> Email Sync.
- **Expected:** `GET /api/email/gmail/status` and `/api/email/outlook/status` populate. Connect buttons or per-account rows visible.
- **Pass criteria:** Loaded without error.
- **iOS reference:** EmailSyncView.

### TC-0219 — Connect Gmail OAuth (happy path)
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Signed in. Network up.
- **Steps:**
  1. Tap Connect Gmail.
  2. Backend returns OAuth URL.
  3. Browser opens; user grants access.
  4. Redirect to `com.spentyai.app://oauth2redirect` caught by `RedirectUriReceiverActivity`.
- **Expected:** Token saved server-side; UI updates to "Connected". Sync starts.
- **Pass criteria:** `GET /api/email/gmail/status` returns connected: true.
- **Known defect:** PARITY MATRIX P0 #9 — `appauth` dependency MISSING from `build.gradle.kts`. Verify it builds and runs.
- **iOS reference:** EmailSyncView Gmail connect.

### TC-0220 — Connect Outlook OAuth
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P1
- **Steps:** Same flow with Outlook.
- **Expected:** Same as TC-0219.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0221 — Disconnect Gmail
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Gmail connected.
- **Steps:**
  1. Tap Disconnect on the row -> confirm dialog.
- **Expected:** `POST /api/email/gmail/disconnect` 200.
- **Pass criteria:** Row goes back to "Connect" state.
- **iOS reference:** Same.

### TC-0222 — Disconnect Outlook
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P1
- **Steps:** Same with Outlook.
- **Expected:** Same.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0223 — Add another Gmail account
- **Area:** EmailSync
- **Type:** UI
- **Severity:** P1
- **Preconditions:** One Gmail already connected.
- **Steps:** Tap "Add another Gmail".
- **Expected:** Opens OAuth for additional account; both accounts listed.
- **Pass criteria:** Multi-account UX.
- **Known defect:** PARITY MATRIX P1 #32 — multi-account flow MISSING on Android.
- **iOS reference:** Add another Gmail.

### TC-0224 — Sync date preset (7/30/90/180 days)
- **Area:** EmailSync
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Connecting a fresh account.
- **Steps:** Tap "Sync from..." picker.
- **Expected:** SyncDatePickerSheet opens with 7/30/90/180 day presets.
- **Pass criteria:** Selected date applied.
- **Known defect:** PARITY MATRIX P1 #32 — `SyncDatePickerSheet` MISSING.
- **iOS reference:** SyncDatePickerSheet.

### TC-0225 — Last-checked timestamp visible
- **Area:** EmailSync
- **Type:** UI
- **Severity:** P2
- **Steps:** Open EmailSyncScreen.
- **Expected:** Per-account row shows last-checked time.
- **Pass criteria:** Timestamp present and refreshes.
- **iOS reference:** Same.

### TC-0226 — Sync progress phase indicator
- **Area:** EmailSync
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Sync running.
- **Steps:** Trigger Sync Now.
- **Expected:** Phase indicator shows idle/syncing/complete/failed.
- **Pass criteria:** State transitions visible.
- **Known defect:** PARITY MATRIX P1 #32 — phase indicator MISSING.
- **iOS reference:** Same.

### TC-0227 — Sync now triggers backend sync
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Account connected.
- **Steps:** Tap Sync Now on a row.
- **Expected:** `POST /api/email/start-sync` 200. New emails parsed into pending review.
- **Pass criteria:** Pending count increases or unchanged if no new emails.
- **iOS reference:** Same.

### TC-0228 — Retry failed emails
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Some emails failed parsing.
- **Steps:** Tap Retry Failed.
- **Expected:** `POST /api/email/retry-pending` 200.
- **Pass criteria:** Failed count drops.
- **iOS reference:** Same.

### TC-0229 — Pull-to-refresh on EmailSyncScreen
- **Area:** EmailSync
- **Type:** UI
- **Severity:** P1
- **Steps:** Drag.
- **Expected:** Status refetched.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #32.
- **iOS reference:** Same.

### TC-0230 — Connection success animated overlay
- **Area:** EmailSync
- **Type:** UI
- **Severity:** P2
- **Preconditions:** Connecting Gmail.
- **Steps:** Complete OAuth.
- **Expected:** Animated success overlay before returning to list.
- **Pass criteria:** Overlay shown.
- **Known defect:** PARITY MATRIX P1 #32 — animation MISSING.
- **iOS reference:** Animated overlay.

### TC-0231 — Polling lifecycle stops on screen exit
- **Area:** EmailSync
- **Type:** Performance
- **Severity:** P1
- **Preconditions:** Sync polling active.
- **Steps:**
  1. Start sync.
  2. Press back to leave EmailSyncScreen.
- **Expected:** Polling cancelled (no continued network calls).
- **Pass criteria:** No network calls after leaving.
- **Known defect:** PARITY MATRIX P1 #32 — lifecycle stop MISSING on Android.
- **iOS reference:** `.onDisappear`.

### TC-0232 — Endpoint path mismatch: gmail connect
- **Area:** EmailSync
- **Type:** Backend
- **Severity:** P0
- **Steps:** Capture connect call.
- **Expected:** Android sends `GET /api/email/gmail/connect` (iOS uses `/api/gmail/connect`).
- **Pass criteria:** Backend dual-supports OR Android aligned.
- **Known defect:** PARITY MATRIX P0 #7 — endpoint mismatch.
- **iOS reference:** `/api/gmail/connect?platform=ios`.

### TC-0233 — Pending Review tab from EmailSync
- **Area:** EmailSync
- **Type:** UI
- **Severity:** P0
- **Steps:** Tap "Pending Review" link.
- **Expected:** Navigates to `PendingReviewScreen`.
- **Pass criteria:** Pending list loaded.
- **iOS reference:** Same NavLink.

### TC-0234 — Edit pending transaction in PendingReview
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Pending row exists.
- **Steps:** Tap Edit -> change amount -> Save.
- **Expected:** `PATCH /api/transactions/{id}` 200.
- **Pass criteria:** Updated.
- **iOS reference:** EditTransactionSheet.

### TC-0235 — View source email from PendingReview row
- **Area:** EmailSync
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap View Source.
- **Expected:** ViewSourceSheet opens; `GET /api/email/source/{id}` returns content.
- **Pass criteria:** Email rendered.
- **iOS reference:** ViewSourceSheet.

### TC-0236 — SMS Sync screen functional
- **Area:** SMS
- **Type:** UI
- **Severity:** P1
- **Steps:** More -> SMS Sync.
- **Expected:** SMS paste field, parse button, mandate detection, retry.
- **Pass criteria:** Works end-to-end.
- **Known defect:** PARITY MATRIX P1 #23 — Android shows placeholder "Coming Soon". Expected: FAIL until built (paste-based, no READ_SMS).
- **iOS reference:** SMSSyncView.

### TC-0237 — Mandate detection trigger from EmailSync
- **Area:** EmailSync
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Mandate detection UI present.
- **Steps:** Tap "Detect Mandates".
- **Expected:** `POST /api/mandates/detect` 200.
- **Pass criteria:** Mandates list updates.
- **Known defect:** Mandates UI MISSING on Android — see Section E.
- **iOS reference:** Same endpoint.

---

## M. Settings / More menu

### TC-0238 — More menu sections render
- **Area:** Settings / Nav
- **Type:** UI
- **Severity:** P1
- **Steps:** Tap More tab.
- **Expected:** Sections shown: Finance / People / Data / Tools / Account. Rows under each render.
- **Pass criteria:** All declared rows visible.
- **iOS reference:** MoreMenuView (iOS additionally has Obligations).

### TC-0239 — More menu missing Obligations / Mandates row
- **Area:** Settings / Nav
- **Type:** UI
- **Severity:** P1
- **Steps:** Inspect More menu sections.
- **Expected:** A "Mandates" / "Obligations" row should be present so user can reach mandates UI.
- **Pass criteria:** Row visible.
- **Known defect:** PARITY MATRIX — Mandates UI MISSING; not surfaced in More menu. Expected: FAIL.
- **iOS reference:** Obligations section.

### TC-0240 — Edit Business Profile
- **Area:** Settings
- **Type:** E2E
- **Severity:** P1
- **Steps:**
  1. Settings -> Business Profile.
  2. Edit firm name, GSTIN, PAN, state, country, address.
  3. Save.
- **Expected:** `PUT /api/settings` 200.
- **Pass criteria:** Values persist on reload.
- **iOS reference:** BusinessProfileView.

### TC-0241 — Country picker in BusinessProfile lists 10+ countries
- **Area:** Settings
- **Type:** UI
- **Severity:** P2
- **Steps:** Open country picker.
- **Expected:** ≥ 10 countries (matching iOS hard-coded list).
- **Pass criteria:** Same set as iOS.
- **Known defect:** PARITY MATRIX P2 #48 — picker depth not confirmed.
- **iOS reference:** BusinessProfileView.

### TC-0242 — Indian state picker
- **Area:** Settings
- **Type:** UI
- **Severity:** P2
- **Preconditions:** Country = India.
- **Steps:** Open state picker.
- **Expected:** All Indian states + UTs listed.
- **Pass criteria:** Same as iOS.
- **iOS reference:** Same.

### TC-0243 — Currency settings — change base currency
- **Area:** Settings
- **Type:** E2E
- **Severity:** P1
- **Steps:**
  1. Settings -> Currency & Locale.
  2. Pick USD.
  3. Save.
- **Expected:** `PUT /api/settings` 200; UI reflects new symbol on Dashboard.
- **Pass criteria:** Symbols update everywhere.
- **iOS reference:** CurrencySettingsView.

### TC-0244 — Currency dropdown populated from /api/settings/currencies
- **Area:** Settings
- **Type:** Backend
- **Severity:** P2
- **Steps:** Inspect calls when opening currency picker.
- **Expected:** `GET /api/settings/currencies` called separately to populate options.
- **Pass criteria:** Endpoint hit.
- **Known defect:** PARITY MATRIX P1 #43 — Android currently relies on `/api/settings` only.
- **iOS reference:** Separate endpoint.

### TC-0245 — Date format dropdown populated
- **Area:** Settings
- **Type:** Backend
- **Severity:** P2
- **Steps:** Open date format picker.
- **Expected:** `GET /api/settings/date-formats` populates.
- **Pass criteria:** Options shown.
- **Known defect:** Same as TC-0244.
- **iOS reference:** Same.

### TC-0246 — Logo upload (PhotosPicker) wired to backend
- **Area:** Settings
- **Type:** E2E
- **Severity:** P1
- **Steps:**
  1. Settings -> Upload Logo.
  2. Pick image.
- **Expected:** `POST /api/settings/logo` uploads. Logo shown thereafter on invoice PDF.
- **Pass criteria:** Server confirms.
- **Known defect:** PARITY MATRIX P1 #28 — Android UI is placeholder. Expected: FAIL.
- **iOS reference:** Same.

### TC-0247 — Logo delete
- **Area:** Settings
- **Type:** E2E
- **Severity:** P1
- **Steps:** Tap delete on logo.
- **Expected:** `DELETE /api/settings/logo` 200.
- **Pass criteria:** Logo removed.
- **Known defect:** Same.
- **iOS reference:** Same.

### TC-0248 — Signature upload
- **Area:** Settings
- **Type:** E2E
- **Severity:** P1
- **Steps:** Settings -> Upload Signature -> pick image.
- **Expected:** `POST /api/settings/signature` 200.
- **Pass criteria:** Signature embedded on invoice PDF.
- **Known defect:** PARITY MATRIX P1 #28.
- **iOS reference:** Same.

### TC-0249 — Signature delete
- **Area:** Settings
- **Type:** E2E
- **Severity:** P1
- **Steps:** Tap delete on signature.
- **Expected:** `DELETE /api/settings/signature` 200.
- **Pass criteria:** Removed.
- **Known defect:** Same.
- **iOS reference:** Same.

### TC-0250 — Address textarea persists
- **Area:** Settings
- **Type:** E2E
- **Severity:** P1
- **Steps:**
  1. BusinessProfile -> Address.
  2. Type multi-line address.
  3. Save.
- **Expected:** Newlines preserved on reload.
- **Pass criteria:** Same.
- **iOS reference:** Address textarea.

### TC-0251 — Language toggle (en/hi)
- **Area:** Settings / Localization
- **Type:** UI
- **Severity:** P1
- **Steps:** Look for Language row.
- **Expected:** Toggle between English and Hindi; UI switches.
- **Pass criteria:** Strings localized.
- **Known defect:** PARITY MATRIX P1 #30 — Hindi MISSING. Expected: FAIL.
- **iOS reference:** LocalizationManager.

### TC-0252 — Help Center link in Settings
- **Area:** Settings
- **Type:** UI
- **Severity:** P1
- **Steps:** Look for Help Center row.
- **Expected:** Tap opens `https://www.spentyai.com/help` in browser.
- **Pass criteria:** Link works.
- **Known defect:** PARITY MATRIX P1 #27 — Help Center link MISSING on Android.
- **iOS reference:** Settings Help row.

### TC-0253 — Privacy Policy link
- **Area:** Settings
- **Type:** UI
- **Severity:** P2
- **Steps:** Tap Privacy.
- **Expected:** Opens privacy URL in browser.
- **Pass criteria:** Link works.
- **Known defect:** PARITY MATRIX — Legal & Support section MISSING in Settings on Android.
- **iOS reference:** Same.

### TC-0254 — Terms of Service link
- **Area:** Settings
- **Type:** UI
- **Severity:** P2
- **Steps:** Tap Terms.
- **Expected:** Opens terms URL.
- **Pass criteria:** Same.
- **Known defect:** Same.
- **iOS reference:** Same.

### TC-0255 — Refund Policy link
- **Area:** Settings
- **Type:** UI
- **Severity:** P2
- **Steps:** Tap Refund.
- **Expected:** Opens refund URL.
- **Pass criteria:** Same.
- **Known defect:** Same.
- **iOS reference:** Same.

### TC-0256 — About row shows app version
- **Area:** Settings
- **Type:** UI
- **Severity:** P2
- **Steps:** Tap About.
- **Expected:** Shows `versionName` (1.0.0) + `versionCode` (1).
- **Pass criteria:** Values match BuildConfig.
- **Known defect:** Section MISSING.
- **iOS reference:** App Version row.

### TC-0257 — Contact Support mailto:
- **Area:** Settings
- **Type:** UI
- **Severity:** P2
- **Steps:** Tap Contact Support.
- **Expected:** Opens mailto: prefilled (or shows ticket form fallback).
- **Pass criteria:** Mail client opens.
- **Known defect:** PARITY MATRIX — only ticket form on Android, no mailto.
- **iOS reference:** mailto: link.

### TC-0258 — Support ticket form submit
- **Area:** Settings / Support
- **Type:** E2E
- **Severity:** P1
- **Steps:**
  1. More -> Support.
  2. Fill subject + message.
  3. Submit.
- **Expected:** `POST /api/support/tickets` 200; success dialog.
- **Pass criteria:** Server logs ticket.
- **iOS reference:** SupportView ticket form.

### TC-0259 — Support FAQ accordions
- **Area:** Settings / Support
- **Type:** UI
- **Severity:** P1
- **Steps:** Open SupportScreen.
- **Expected:** FAQ accordions populated from `GET /api/support/faq`.
- **Pass criteria:** Accordions expand/collapse with content.
- **Known defect:** PARITY MATRIX P1 #29 — FAQ accordions MISSING on Android.
- **iOS reference:** SupportView FAQ.

### TC-0260 — Feature requests list and vote
- **Area:** Settings / Tools
- **Type:** E2E
- **Severity:** P1
- **Steps:**
  1. More -> Feature Requests.
  2. Tap upvote on a row.
- **Expected:** `POST /api/feature-requests/{id}/vote` 200; vote count increments.
- **Pass criteria:** UI updates.
- **iOS reference:** FeatureRequestsView.

### TC-0261 — Submit a new feature request
- **Area:** Settings / Tools
- **Type:** E2E
- **Severity:** P1
- **Steps:** + -> form -> Save.
- **Expected:** `POST /api/feature-requests` 200; row appears.
- **Pass criteria:** Same.
- **iOS reference:** FeatureRequestFormView.

### TC-0262 — Privacy Policy / Terms on LoginScreen footer
- **Area:** Settings
- **Type:** UI
- **Severity:** P2
- **Steps:** Tap Terms / Privacy on Login.
- **Expected:** Browser opens correct URL.
- **Pass criteria:** Same.
- **iOS reference:** LoginView footer.

---

## N. Billing / Paywall (CRITICAL — known bugs)

### TC-0263 — Paywall appears on cold launch when not subscribed
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Account with `subscriptionStatus.isActive = false`. Cold start.
- **Steps:**
  1. Sign in via Google.
- **Expected:** Routed to `SubscriptionPaywallScreen` BEFORE MainTab. Cannot reach Dashboard until subscribed or trial accepted.
- **Pass criteria:** Paywall is the start destination after login when not subscribed.
- **Known defect:** PARITY MATRIX CRITICAL #6, P0 #6 — subscription gate MISSING on Android. Expected: FAIL until enforcement added in `AppNavigation.kt`.
- **iOS reference:** AppRouter routes unsubscribed users to SubscriptionPaywall.

### TC-0264 — Paywall reachable from Billing screen
- **Area:** Billing
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Subscribed user (verify accessible).
- **Steps:** More -> Billing -> tap Subscribe / pricing card.
- **Expected:** SubscriptionPaywallScreen opens.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0265 — Plan card prices match expected values
- **Area:** Billing
- **Type:** UI
- **Severity:** P0
- **Preconditions:** SubscriptionPaywallScreen open.
- **Steps:** Inspect each plan card.
- **Expected:** Monthly ₹199, Quarterly ₹449, Yearly ₹1499. Lifetime + Lifetime Offer prices match iOS fallback.
- **Pass criteria:** Prices visible and match `BillingRepository.fallbackPlans`.
- **iOS reference:** BillingView plan cards.

### TC-0266 — 7-day free trial chip on appropriate plans
- **Area:** Billing
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Paywall open.
- **Steps:** Inspect plan cards.
- **Expected:** "7-day free trial" chip on plans that offer it (Monthly / Yearly).
- **Pass criteria:** Chip rendered.
- **iOS reference:** Same.

### TC-0267 — Tap Subscribe launches Google Play purchase sheet
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Paywall open. Test Play account with internal testing access.
- **Steps:**
  1. Tap Subscribe on Monthly plan.
- **Expected:** Google Play Billing sheet opens via `BillingClient.launchBillingFlow`.
- **Pass criteria:** Play UI displayed.
- **Known defect:** PARITY MATRIX CRITICAL #1 — SKU naming mismatch. Currently `purchasePlan(productId)` is given `com.spentyai.monthly` but `queryProductDetails` only fetched `spenty_monthly`/`spenty_yearly`. Lookup fails -> sheet never launches. Expected: FAIL until SKU sets aligned. Quarterly + Lifetime never queried at all.
- **iOS reference:** StoreKit 2 Subscribe.

### TC-0268 — Purchase Quarterly plan launches Play sheet
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Steps:** Tap Subscribe on Quarterly.
- **Expected:** Play sheet opens with Quarterly product.
- **Pass criteria:** Same.
- **Known defect:** Quarterly SKU never queried -> guaranteed fail until SKU set extended.
- **iOS reference:** Same.

### TC-0269 — Purchase Yearly plan launches Play sheet
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Steps:** Tap Subscribe on Yearly.
- **Expected:** Play sheet opens with Yearly product.
- **Pass criteria:** Same.
- **Known defect:** SKU mismatch (`com.spentyai.yearly` vs `spenty_yearly`).
- **iOS reference:** Same.

### TC-0270 — Purchase Lifetime plan launches Play sheet
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Steps:** Tap Subscribe on Lifetime.
- **Expected:** Play sheet opens with Lifetime in-app product.
- **Pass criteria:** Same.
- **Known defect:** Lifetime SKU never queried.
- **iOS reference:** Same.

### TC-0271 — Successful purchase calls /api/subscription/verify
- **Area:** Billing
- **Type:** Backend / E2E
- **Severity:** P0
- **Preconditions:** Play test card succeeds.
- **Steps:**
  1. Complete a Play purchase.
  2. Inspect network calls.
- **Expected:** App sends purchase token + product ID to `POST /api/subscription/verify` BEFORE acknowledging.
- **Pass criteria:** Verify call captured; server records purchase.
- **Known defect:** PARITY MATRIX CRITICAL #2, P0 #2 — verify never called. `BillingViewModel.handlePurchase` only acknowledges + refreshes status. Expected: FAIL until verify call added.
- **iOS reference:** `POST /api/payments/apple/verify` after StoreKit purchase.

### TC-0272 — Successful purchase acknowledged via BillingClient
- **Area:** Billing
- **Type:** Backend
- **Severity:** P0
- **Steps:** After purchase, observe BillingClient.acknowledgePurchase invocation.
- **Expected:** `AcknowledgePurchaseParams` called within 3 days of purchase per Play policy.
- **Pass criteria:** Acknowledged within session.
- **iOS reference:** N/A — Android-only.

### TC-0273 — After successful purchase, paywall dismisses
- **Area:** Billing
- **Type:** UI
- **Severity:** P0
- **Steps:** Complete purchase.
- **Expected:** Paywall auto-dismisses; subscription status refreshes; user lands on Dashboard.
- **Pass criteria:** Status updated; dismiss observed.
- **iOS reference:** Same.

### TC-0274 — Restore Purchases button visible on paywall
- **Area:** Billing
- **Type:** UI
- **Severity:** P0
- **Steps:** Look for Restore button on `SubscriptionPaywallScreen`.
- **Expected:** Button visible.
- **Pass criteria:** Button present.
- **Known defect:** PARITY MATRIX CRITICAL, P0 #8 — Restore Purchases MISSING on Android paywall (and BillingScreen). Expected: FAIL until added — required by Play UX and support flows.
- **iOS reference:** SubscriptionPaywall Restore button.

### TC-0275 — Tap Restore Purchases triggers queryPurchasesAsync
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** User previously purchased on different device.
- **Steps:** Tap Restore.
- **Expected:** `queryPurchasesAsync` runs; subscription restored if found; result alert shown.
- **Pass criteria:** Subscription returns active.
- **Known defect:** Same as TC-0274.
- **iOS reference:** showRestoreResult alert.

### TC-0276 — Cancel subscription opens Play subscription page
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Active Play subscription.
- **Steps:**
  1. Billing -> Cancel Subscription.
  2. Confirm dialog.
- **Expected:** Either calls a real backend cancel endpoint OR opens `https://play.google.com/store/account/subscriptions?sku={SKU}&package={PACKAGE}` in Play.
- **Pass criteria:** Server / Play state updates.
- **Known defect:** PARITY MATRIX CRITICAL #3, P0 #3 — `BillingRepository.cancelSubscription` returns Success(Unit) without any call. UI lies. Expected: FAIL until real implementation.
- **iOS reference:** External apps.apple.com link.

### TC-0277 — Promo code validate
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Steps:**
  1. Enter "TESTPROMO" in promo field.
  2. Tap Validate.
- **Expected:** `POST /api/promo/validate` 200; UI shows promo details.
- **Pass criteria:** Real call made.
- **Known defect:** PARITY MATRIX CRITICAL #4, P0 #4 — `validatePromo` returns hard-coded "not yet available on Android". Expected: FAIL.
- **iOS reference:** Same endpoint.

### TC-0278 — Promo code activate
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Steps:** After validate, tap Activate.
- **Expected:** `POST /api/promo/activate` 200; subscription extended/discounted.
- **Pass criteria:** Real call.
- **Known defect:** Same.
- **iOS reference:** Same endpoint.

### TC-0279 — Payment History populated from server
- **Area:** Billing
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** User with at least one prior purchase.
- **Steps:** Billing -> Payment History.
- **Expected:** `GET /api/payments/history` 200; rows show past PaymentOrders.
- **Pass criteria:** History populated.
- **Known defect:** PARITY MATRIX CRITICAL #5, P0 #5 — Android repo returns `Success(emptyList())`. Expected: FAIL.
- **iOS reference:** PaymentHistoryView.

### TC-0280 — Endpoint mismatches: payment plans
- **Area:** Billing
- **Type:** Backend
- **Severity:** P0
- **Steps:** Capture call for plan list.
- **Expected:** Android calls `GET /api/payment-plans`. iOS uses `/api/payments/plans`. Backend dual-supports OR Android aligned.
- **Pass criteria:** 200 returned.
- **Known defect:** PARITY MATRIX P0 #7.
- **iOS reference:** `/api/payments/plans`.

### TC-0281 — Endpoint mismatches: subscription status
- **Area:** Billing
- **Type:** Backend
- **Severity:** P0
- **Steps:** Capture status call.
- **Expected:** Android calls `GET /api/subscription/status`; iOS `/api/payments/status`. Confirm dual-support.
- **Pass criteria:** 200.
- **Known defect:** Same.
- **iOS reference:** Same.

### TC-0282 — Lifetime offer countdown sheet
- **Area:** Billing
- **Type:** UI
- **Severity:** P2
- **Preconditions:** Lifetime offer eligible user.
- **Steps:** Trigger via lifetime-offer event.
- **Expected:** `LifetimeOfferSheet` opens with countdown timer + Accept/Decline.
- **Pass criteria:** Sheet shown.
- **Known defect:** PARITY MATRIX P1 #45 — LifetimeOfferSheet MISSING on Android.
- **iOS reference:** LifetimeOfferSheet.

### TC-0283 — Subscription gating: deep link to /transactions while not subscribed
- **Area:** Billing
- **Type:** Negative
- **Severity:** P0
- **Preconditions:** Not subscribed.
- **Steps:** Trigger deep link to `transactions` route.
- **Expected:** Routed to paywall.
- **Pass criteria:** Cannot bypass gate.
- **Known defect:** Same as TC-0263.
- **iOS reference:** Same.

### TC-0284 — User cancelled Play purchase mid-flow
- **Area:** Billing
- **Type:** Negative
- **Severity:** P1
- **Steps:** Open Play sheet -> tap back / cancel.
- **Expected:** Returns to paywall; no toast/alert spam; no incomplete state.
- **Pass criteria:** UI clean.
- **iOS reference:** Same.

### TC-0285 — Pending Play purchase (delayed approval)
- **Area:** Billing
- **Type:** Edge
- **Severity:** P1
- **Preconditions:** Play test card simulating pending state.
- **Steps:** Complete with pending result.
- **Expected:** UI shows "Pending approval" message; subscription not yet active until resolved.
- **Pass criteria:** State handled gracefully.
- **iOS reference:** N/A.

### TC-0286 — BillingClient connection failure handling
- **Area:** Billing
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Play services unavailable (test in emulator without Play).
- **Steps:** Open paywall.
- **Expected:** Error AlertDialog "Google Play unavailable"; no crash.
- **Pass criteria:** Same.
- **iOS reference:** N/A.

---

## O. Reconciliation

### TC-0287 — ReconciliationScreen lists statements
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P1
- **Steps:** More -> Reconciliation.
- **Expected:** `GET /api/statements/list` 200; rows shown.
- **Pass criteria:** Same.
- **iOS reference:** ReconciliationView.

### TC-0288 — Upload bank statement (PDF)
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Reconciliation open.
- **Steps:**
  1. Tap upload IconButton -> StatementUploadSheet.
  2. Pick sub-type, account, period dates.
  3. Pick PDF.
  4. Tap Upload.
- **Expected:** Server accepts; processing status begins.
- **Pass criteria:** Row appears in list with processing badge.
- **iOS reference:** StatementUploadView.

### TC-0289 — Upload Excel statement
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P1
- **Steps:** Same flow with .xlsx.
- **Expected:** Accepted.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0290 — Upload CSV statement
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Verify CSV is allowed mime type on Android picker.
- **Steps:** Pick .csv.
- **Expected:** Accepted.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX — verify Android file picker accepts CSV.
- **iOS reference:** Same.

### TC-0291 — Password-protected statement triggers Unlock sheet
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Password-protected PDF.
- **Steps:**
  1. Upload it.
  2. When processing fails with locked status, tap statement.
- **Expected:** UnlockSheet opens; enter password; `POST /api/statements/{id}/unlock` 200.
- **Pass criteria:** Statement processes after unlock.
- **iOS reference:** UnlockSheet.

### TC-0292 — Conflict list visible on StatementDetail
- **Area:** Reconciliation
- **Type:** UI
- **Severity:** P0
- **Preconditions:** Statement processed; conflicts present.
- **Steps:** Open detail.
- **Expected:** Conflict entries listed with type indicator.
- **Pass criteria:** Same.
- **iOS reference:** StatementDetailView.

### TC-0293 — Resolve conflict via per-entry edit
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** Conflict shown.
- **Steps:** Tap row -> edit -> save.
- **Expected:** `PATCH /api/statements/{statementId}/entries/{index}` 200.
- **Pass criteria:** Conflict resolved.
- **iOS reference:** Same.

### TC-0294 — Bulk categorize entries
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P1
- **Steps:** Multi-select entries -> BulkCategorizeSheet -> pick category.
- **Expected:** `POST /api/statements/{id}/bulk-categorize` 200.
- **Pass criteria:** Categories applied.
- **iOS reference:** BulkCategorizeSheet.

### TC-0295 — Reconcile action
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P0
- **Steps:** Detail -> Reconcile.
- **Expected:** `POST /api/statements/{id}/reconcile` 200; matched/unmatched stats refresh.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0296 — Re-audit action
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P1
- **Steps:** Detail -> Re-audit.
- **Expected:** `POST /api/statements/{id}/reaudit` 200.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0297 — Add Missing transaction
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P1
- **Steps:** Detail -> Add Missing -> form -> Save.
- **Expected:** `POST /api/statements/{id}/add-missing` 200; new txn created.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0298 — Approve statement
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P0
- **Steps:** Detail -> Approve.
- **Expected:** `POST /api/statements/{id}/approve` 200; entries become approved transactions.
- **Pass criteria:** Status updates.
- **iOS reference:** Same.

### TC-0299 — Reject statement
- **Area:** Reconciliation
- **Type:** E2E
- **Severity:** P0
- **Steps:** Detail -> Reject -> confirm.
- **Expected:** `POST /api/statements/{id}/reject` 200.
- **Pass criteria:** Status -> rejected.
- **iOS reference:** Same.

### TC-0300 — Audit trail visible on statement
- **Area:** Reconciliation
- **Type:** UI
- **Severity:** P1
- **Steps:** Detail -> audit log section.
- **Expected:** Lists of who/when each action ran.
- **Pass criteria:** Audit log present.
- **iOS reference:** Same.

### TC-0301 — Delete statement
- **Area:** Reconciliation
- **Type:** E2E / Destructive
- **Severity:** P1
- **Steps:** ReconciliationScreen -> long-press / row option -> Delete -> confirm dialog.
- **Expected:** `DELETE /api/statements/{id}/delete` 200.
- **Pass criteria:** Row removed.
- **iOS reference:** Swipe Delete.

### TC-0302 — Swipe-to-delete on statement list
- **Area:** Reconciliation
- **Type:** UI
- **Severity:** P2
- **Steps:** Swipe row.
- **Expected:** Delete revealed.
- **Pass criteria:** Same.
- **Known defect:** Swipe MISSING on Android.
- **iOS reference:** Same.

### TC-0303 — Pull-to-refresh on reconciliation list
- **Area:** Reconciliation
- **Type:** UI
- **Severity:** P2
- **Steps:** Drag.
- **Expected:** Refetch.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** Same.

### TC-0304 — Reconciliation accuracy regression
- **Area:** Reconciliation
- **Type:** Backend
- **Severity:** P0
- **Preconditions:** Per `reconciliation_qa_2026_04_26_handoff.md`, accuracy fix shipped at commit `acd49da`. False conflicts should be ≤ 3.
- **Steps:**
  1. Upload the canonical test statement.
  2. Run reconcile.
- **Expected:** False-positive conflicts ≤ 3 (was 9 pre-fix).
- **Pass criteria:** Match baseline from handoff memory.
- **iOS reference:** Same backend.

---

## P. Cross-cutting

### TC-0305 — Pull-to-refresh on Dashboard (cross-cutting check)
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Dashboard.
- **Steps:** Drag down.
- **Expected:** Refresh indicator + refetch.
- **Pass criteria:** Visible animation; new data.
- **Known defect:** PARITY MATRIX P1 #34.
- **iOS reference:** Same.

### TC-0306 — Pull-to-refresh on every list screen audit
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P1
- **Preconditions:** Open each screen sequentially.
- **Steps:** Drag down on TransactionList, AccountList, CategoryList, CustomerList, VendorList, InvoiceList, PurchaseList, RecordsScreen, ReconciliationScreen, EmailSyncScreen, FeatureRequestsScreen, PastInsightsScreen, ReportsScreen, CashFlowScreen.
- **Expected:** Each shows a refresh indicator and refetches.
- **Pass criteria:** All 14 screens support pull-to-refresh.
- **Known defect:** PARITY MATRIX P1 #34 — most MISSING on Android. Expected: many FAIL until added.
- **iOS reference:** `.refreshable`.

### TC-0307 — Empty state on every list screen audit
- **Area:** Cross-cutting
- **Type:** UI / Edge
- **Severity:** P1
- **Preconditions:** Fresh account.
- **Steps:** Visit each list screen.
- **Expected:** Each shows EmptyStateView with relevant CTA.
- **Pass criteria:** No blank screens; all CTAs functional.
- **iOS reference:** Same.

### TC-0308 — Loading state on every screen audit
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P2
- **Steps:** Throttle network to 3G; navigate to each list/detail screen.
- **Expected:** LoadingView shimmer or spinner shown until data arrives.
- **Pass criteria:** No flash of empty state.
- **iOS reference:** Same.

### TC-0309 — Error state on every screen (offline simulation)
- **Area:** Cross-cutting
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Airplane mode ON.
- **Steps:** Open each list/detail screen.
- **Expected:** Each shows ErrorBanner / AlertDialog with retry.
- **Pass criteria:** No crashes; retry works after network restored.
- **iOS reference:** Same.

### TC-0310 — Back button behavior on detail screens
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P1
- **Steps:** Open detail screen -> press system back.
- **Expected:** Returns to list. Bottom bar reappears (since detail hides it).
- **Pass criteria:** Each detail navigates back correctly.
- **iOS reference:** NavigationStack.

### TC-0311 — Bottom-bar visibility on past_insight/{id}
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P2
- **Steps:** Open Past Insights -> a row.
- **Expected:** Bottom bar should be hidden (matching iOS NavigationStack).
- **Pass criteria:** Bar hidden.
- **Known defect:** PARITY MATRIX P1 #41 — `past_insight/{id}` NOT in hide list. Expected: FAIL.
- **iOS reference:** Same.

### TC-0312 — Bottom-bar visibility on record_preview/{id}
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P2
- **Steps:** Open Records -> a row.
- **Expected:** Bottom bar hidden.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #41 — MISSING from hide list.
- **iOS reference:** Same.

### TC-0313 — Bottom-bar visibility on statement_detail/{id}
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P2
- **Steps:** Open Reconciliation -> a row.
- **Expected:** Bottom bar hidden.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #41.
- **iOS reference:** Same.

### TC-0314 — Bottom-bar visibility on pending_review
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P2
- **Steps:** Dashboard banner -> PendingReviewScreen.
- **Expected:** Bottom bar hidden.
- **Pass criteria:** Same.
- **Known defect:** Same.
- **iOS reference:** Same.

### TC-0315 — Deep-link entry into Dashboard tab
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P2
- **Steps:** `adb shell am start -a android.intent.action.VIEW -d "spentyai://nav/dashboard" com.spentyai.app`.
- **Expected:** App opens to Dashboard tab.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P2 #46 — `spentyai://nav/<tab>` MISSING on Android.
- **iOS reference:** spentyai://nav/dashboard.

### TC-0316 — Deep-link entry into Transactions tab
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P2
- **Steps:** Same with `/nav/transactions`.
- **Expected:** Opens to Transactions tab.
- **Pass criteria:** Same.
- **Known defect:** Same.
- **iOS reference:** Same.

### TC-0317 — OAuth deep link to redirect URI
- **Area:** Cross-cutting
- **Type:** E2E
- **Severity:** P0
- **Steps:** During Gmail OAuth, allow browser to redirect to `com.spentyai.app://oauth2redirect`.
- **Expected:** RedirectUriReceiverActivity catches it and continues sign-in.
- **Pass criteria:** Connection completes.
- **Known defect:** PARITY MATRIX P0 #9 — `appauth` dep MISSING; receiver class may not resolve.
- **iOS reference:** ASWebAuthenticationSession.

### TC-0318 — Process death + restore on Transactions tab
- **Area:** Cross-cutting
- **Type:** Edge
- **Severity:** P1
- **Preconditions:** "Don't keep activities" ON.
- **Steps:**
  1. Open Transactions, scroll to row 80.
  2. Background; switch to heavy app.
  3. Resume.
- **Expected:** App restores to Transactions; scroll position preserved or top.
- **Pass criteria:** No crash; data reloaded.
- **iOS reference:** Same.

### TC-0319 — Configuration change: rotate Dashboard
- **Area:** Cross-cutting
- **Type:** Edge / a11y
- **Severity:** P2
- **Steps:** Rotate to landscape.
- **Expected:** Layout reflows; KPIs visible; no overlap.
- **Pass criteria:** Same.
- **iOS reference:** N/A.

### TC-0320 — Dark mode rendering across all screens
- **Area:** Cross-cutting
- **Type:** UI / a11y
- **Severity:** P2
- **Preconditions:** System dark mode ON.
- **Steps:** Visit each top-level screen.
- **Expected:** Material3 dark theme applied; legible contrast.
- **Pass criteria:** No invisible text or wrong-tone surfaces.
- **iOS reference:** Same.

### TC-0321 — Slow network (3G throttle)
- **Area:** Cross-cutting
- **Type:** Performance
- **Severity:** P2
- **Preconditions:** Charles Proxy 3G throttling enabled.
- **Steps:** Open Dashboard / Transactions / Reports.
- **Expected:** Loading states shown; no timeouts under 30s. Retries graceful.
- **Pass criteria:** No crash; eventual success.
- **iOS reference:** Same.

### TC-0322 — System back from MainTab exits app cleanly
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P1
- **Steps:** On Dashboard, press back.
- **Expected:** App moves to background (or Android default exit). No crash.
- **Pass criteria:** Same.
- **iOS reference:** N/A.

### TC-0323 — System back from detail returns to list
- **Area:** Cross-cutting
- **Type:** UI
- **Severity:** P1
- **Steps:** TransactionDetail -> system back.
- **Expected:** Returns to TransactionList.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0324 — Notification permission prompt absent
- **Area:** Cross-cutting
- **Type:** Negative
- **Severity:** P2
- **Preconditions:** Android 13+.
- **Steps:** Launch the app fresh.
- **Expected:** No POST_NOTIFICATIONS prompt (push not implemented).
- **Pass criteria:** No prompt.
- **iOS reference:** Same — neither platform has push.

---

## Q. Negative / edge

### TC-0325 — Form validation: empty required fields on TransactionForm
- **Area:** Negative / Forms
- **Type:** Negative
- **Severity:** P1
- **Steps:** Open TxnForm; tap Save without input.
- **Expected:** Save disabled OR inline error shown.
- **Pass criteria:** No request fired.
- **iOS reference:** Same.

### TC-0326 — Form validation: invalid email on Customer / Vendor / Profile
- **Area:** Negative / Forms
- **Type:** Negative
- **Severity:** P1
- **Steps:** Type "foo@bar" or "bar@" in email fields; try Save.
- **Expected:** Inline error.
- **Pass criteria:** Save blocked.
- **iOS reference:** Same.

### TC-0327 — Form validation: negative amounts on TransactionForm
- **Area:** Negative
- **Type:** Negative
- **Severity:** P1
- **Steps:** Type "-100" in amount.
- **Expected:** Regex disallows "-"; field remains empty/unchanged.
- **Pass criteria:** Same.
- **iOS reference:** Same regex.

### TC-0328 — Form validation: amount with > 2 decimals
- **Area:** Negative
- **Type:** Negative
- **Severity:** P1
- **Steps:** Type "12.345".
- **Expected:** Truncated to "12.34".
- **Pass criteria:** Regex enforced.
- **iOS reference:** Same.

### TC-0329 — Future date where not allowed
- **Area:** Negative
- **Type:** Edge
- **Severity:** P2
- **Steps:** Pick future date in invoice issue date.
- **Expected:** Either accepted or clear validation message.
- **Pass criteria:** Behaviour consistent.
- **iOS reference:** Same.

### TC-0330 — Past date for invoice due date before issue date
- **Area:** Negative
- **Type:** Edge
- **Severity:** P1
- **Steps:** Pick due < issue.
- **Expected:** Inline validation "Due date must be after issue date".
- **Pass criteria:** Save blocked.
- **iOS reference:** Same.

### TC-0331 — Very long string in description (5000 chars)
- **Area:** Negative
- **Type:** Edge
- **Severity:** P2
- **Steps:** Paste 5000-char string into description.
- **Expected:** Either accepted or truncated with feedback.
- **Pass criteria:** No crash.
- **iOS reference:** Same.

### TC-0332 — Special characters / emoji in fields
- **Area:** Negative
- **Type:** Edge
- **Severity:** P2
- **Steps:** Type "😀 / 🙏 / é / 中文" in description.
- **Expected:** Stored correctly; renders in detail and PDF.
- **Pass criteria:** Round-trip identical.
- **iOS reference:** Same.

### TC-0333 — Duplicate account name
- **Area:** Negative
- **Type:** Edge
- **Severity:** P2
- **Steps:** Create two accounts with same name.
- **Expected:** Either allowed (with disambiguation) or backend returns 409.
- **Pass criteria:** Behaviour consistent.
- **iOS reference:** Same.

### TC-0334 — Auth: expired token on next API call
- **Area:** Negative / Auth
- **Type:** Negative
- **Severity:** P0
- **Preconditions:** Manipulate token to be expired.
- **Steps:** Pull-to-refresh.
- **Expected:** App detects 401 and signs out gracefully.
- **Pass criteria:** Returned to LoginScreen.
- **iOS reference:** Same.

### TC-0335 — Auth: invalid refresh token
- **Area:** Negative / Auth
- **Type:** Negative
- **Severity:** P1
- **Preconditions:** Backend simulates invalid refresh.
- **Steps:** Trigger any API call.
- **Expected:** Logged out cleanly.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0336 — Server 500 on transaction save
- **Area:** Negative
- **Type:** Negative
- **Severity:** P1
- **Steps:** Force backend 500; tap Save in form.
- **Expected:** Inline error or AlertDialog "Server error, try again". Form preserved.
- **Pass criteria:** No data loss; user can retry.
- **iOS reference:** Same.

### TC-0337 — Concurrent edit: web vs Android same record
- **Area:** Negative
- **Type:** Edge
- **Severity:** P1
- **Steps:** Edit same txn on web + Android simultaneously; save both.
- **Expected:** Last write wins or 409 surfaced.
- **Pass criteria:** No data corruption.
- **iOS reference:** Same.

### TC-0338 — Storage full when uploading receipt
- **Area:** Negative
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Device with < 50 MB free space.
- **Steps:** Capture receipt with camera.
- **Expected:** Graceful "Storage full" error; no crash.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0339 — Camera unavailable / permission denied
- **Area:** Negative
- **Type:** Negative
- **Severity:** P1
- **Steps:** Deny CAMERA permission on receipt-capture flow.
- **Expected:** Friendly message + link to App Settings.
- **Pass criteria:** No crash; clear path to grant.
- **iOS reference:** Same.

### TC-0340 — RECORD_AUDIO permission denied in AI Chat
- **Area:** Negative
- **Type:** Negative
- **Severity:** P1
- **Steps:** Tap mic; deny permission.
- **Expected:** Inline message "Microphone needed" with retry.
- **Pass criteria:** Mic button disabled until granted.
- **iOS reference:** Same.

### TC-0341 — READ_MEDIA_IMAGES denied on receipt gallery picker
- **Area:** Negative
- **Type:** Negative
- **Severity:** P1
- **Steps:** Deny permission.
- **Expected:** Friendly fallback (use camera or grant).
- **Pass criteria:** No crash.
- **iOS reference:** Same.

### TC-0342 — Backend 503 with Retry-After
- **Area:** Negative
- **Type:** Edge
- **Severity:** P2
- **Preconditions:** Server returns 503.
- **Steps:** Pull-to-refresh.
- **Expected:** Error banner "Service unavailable, retry shortly".
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0343 — Malformed JSON response from backend
- **Area:** Negative
- **Type:** Edge
- **Severity:** P2
- **Steps:** Force backend to return invalid JSON for `/api/dashboard/summary`.
- **Expected:** Error banner; no crash.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0344 — Cleartext traffic blocked
- **Area:** Negative / Security
- **Type:** Edge
- **Severity:** P0
- **Preconditions:** `usesCleartextTraffic=false` in manifest.
- **Steps:** Attempt to point app at `http://...` via DNS spoofing.
- **Expected:** App refuses cleartext; error logged.
- **Pass criteria:** No data sent over HTTP.
- **iOS reference:** Same — App Transport Security.

### TC-0345 — Token visible in OkHttp body logs only in debug
- **Area:** Security
- **Type:** Negative
- **Severity:** P0
- **Preconditions:** Release build.
- **Steps:** Inspect logcat for `Authorization` header.
- **Expected:** Body logging disabled in release; no token leak.
- **Pass criteria:** No sensitive logs.
- **iOS reference:** N/A.

### TC-0346 — Token survives in EncryptedSharedPreferences across reboot
- **Area:** Security
- **Type:** E2E
- **Severity:** P1
- **Preconditions:** Signed in.
- **Steps:** Reboot device. Open app.
- **Expected:** Still signed in (token persisted).
- **Pass criteria:** Same.
- **iOS reference:** Keychain.

### TC-0347 — Sign-out wipes EncryptedSharedPreferences
- **Area:** Security
- **Type:** E2E
- **Severity:** P0
- **Steps:** Sign out, then dump EncryptedSharedPreferences via `run-as`.
- **Expected:** Token entry cleared.
- **Pass criteria:** No leftover token.
- **iOS reference:** Same.

---

## R. Accessibility quick-pass

### TC-0348 — TalkBack reads each LoginScreen control
- **Area:** a11y
- **Type:** a11y
- **Severity:** P1
- **Preconditions:** TalkBack ON.
- **Steps:**
  1. Swipe through Login.
- **Expected:** Each control announces purpose ("Sign in with Google, button"). Terms/Privacy announce as links.
- **Pass criteria:** All controls labelled.
- **iOS reference:** VoiceOver.

### TC-0349 — TalkBack on Dashboard
- **Area:** a11y
- **Type:** a11y
- **Severity:** P1
- **Steps:** TalkBack ON; open Dashboard.
- **Expected:** Each KPI card, FAB, AI sparkle, account card, txn row announces correctly.
- **Pass criteria:** No "unlabelled button" announcements.
- **iOS reference:** Same.

### TC-0350 — TalkBack on TransactionForm
- **Area:** a11y
- **Type:** a11y
- **Severity:** P1
- **Steps:** Open form with TalkBack.
- **Expected:** Each field announces label + state. Save button announces "disabled" until valid.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0351 — TalkBack on PendingReviewScreen
- **Area:** a11y
- **Type:** a11y
- **Severity:** P1
- **Steps:** TalkBack ON; open PendingReview.
- **Expected:** Each row + approve/reject buttons announced. Multi-select state communicated.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0352 — TalkBack on SubscriptionPaywallScreen
- **Area:** a11y / Billing
- **Type:** a11y
- **Severity:** P1
- **Steps:** Open paywall with TalkBack.
- **Expected:** Plan cards, price, period, Subscribe button announce. Restore Purchases button announced (when added).
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0353 — Touch target size ≥ 44dp
- **Area:** a11y
- **Type:** a11y
- **Severity:** P1
- **Steps:** Inspect Compose tree of every IconButton.
- **Expected:** Every tappable element has ≥ 44dp x 44dp touch area (or `minimumInteractiveComponentSize` honoured).
- **Pass criteria:** Layout inspector confirms.
- **iOS reference:** 44pt min on iOS.

### TC-0354 — Color contrast on primary text and badges
- **Area:** a11y
- **Type:** a11y
- **Severity:** P1
- **Steps:** Use Accessibility Scanner on each top-level screen.
- **Expected:** All text contrast ≥ 4.5:1; large text ≥ 3:1. Pending banner amber and red error states pass.
- **Pass criteria:** No contrast warnings.
- **iOS reference:** Same WCAG 2.1 AA.

### TC-0355 — Dynamic font scaling at 130%
- **Area:** a11y
- **Type:** a11y
- **Severity:** P1
- **Preconditions:** System -> Display -> Font Size 130%.
- **Steps:** Visit each top-level screen.
- **Expected:** Layout accommodates larger text without truncation or overlapping. KPIs wrap.
- **Pass criteria:** No clipping; CTAs still tappable.
- **iOS reference:** Dynamic Type.

### TC-0356 — Dynamic font at 200%
- **Area:** a11y
- **Type:** a11y
- **Severity:** P2
- **Preconditions:** Font Size 200%.
- **Steps:** Same.
- **Expected:** Major flows (login, dashboard, txn create) usable; some compromise acceptable.
- **Pass criteria:** No crashes; CTAs reachable via scroll.
- **iOS reference:** Same.

### TC-0357 — Switch Access focus order
- **Area:** a11y
- **Type:** a11y
- **Severity:** P2
- **Preconditions:** Switch Access enabled.
- **Steps:** Step through Login.
- **Expected:** Logical focus order: Google -> (Demo) -> Terms -> Privacy.
- **Pass criteria:** Focus reaches every actionable element.
- **iOS reference:** Same.

### TC-0358 — Reduced motion
- **Area:** a11y
- **Type:** a11y
- **Severity:** P2
- **Preconditions:** System -> Accessibility -> Remove animations ON.
- **Steps:** Use app.
- **Expected:** Animations (chevron rotation, sheet transitions) reduced or instantaneous.
- **Pass criteria:** No motion-induced discomfort.
- **iOS reference:** Same.

---

## S. Performance

### TC-0359 — Cold start under 3 seconds
- **Area:** Performance
- **Type:** Performance
- **Severity:** P1
- **Preconditions:** Pixel 6, Android 14, app force-stopped.
- **Steps:**
  1. `adb shell am force-stop com.spentyai.app`.
  2. `adb shell am start -W com.spentyai.app/.MainActivity`.
  3. Capture `TotalTime`.
- **Expected:** TotalTime ≤ 3000 ms averaged over 3 runs.
- **Pass criteria:** Within budget.
- **iOS reference:** Same target.

### TC-0360 — Warm start under 1 second
- **Area:** Performance
- **Type:** Performance
- **Severity:** P2
- **Steps:** Open from Recents (already in memory).
- **Expected:** ≤ 1000 ms.
- **Pass criteria:** Within budget.
- **iOS reference:** Same.

### TC-0361 — Tab switch under 250 ms
- **Area:** Performance
- **Type:** Performance
- **Severity:** P1
- **Steps:** Tap Transactions from Dashboard; measure with Macrobenchmark or stopwatch.
- **Expected:** ≤ 250 ms first-frame.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0362 — Long list (1000+ txns) scrolls smoothly
- **Area:** Performance
- **Type:** Performance
- **Severity:** P1
- **Preconditions:** Account with 1000+ transactions.
- **Steps:** Open Transactions; flick scroll.
- **Expected:** ≥ 55 fps; no jank > 16 ms (use Android Studio Profiler).
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0363 — Memory footprint reasonable
- **Area:** Performance
- **Type:** Performance
- **Severity:** P2
- **Steps:** Use Profiler -> Memory; idle on Dashboard.
- **Expected:** Native + Java heap < 200 MB on demo dataset.
- **Pass criteria:** Same.
- **iOS reference:** Similar bound.

### TC-0364 — APK size under target
- **Area:** Performance
- **Type:** Performance
- **Severity:** P2
- **Steps:** Inspect release-signed APK size.
- **Expected:** < 30 MB after R8 minification + resource shrinking.
- **Pass criteria:** Same.
- **iOS reference:** N/A.

### TC-0365 — Startup CPU usage under 30% on Pixel 6
- **Area:** Performance
- **Type:** Performance
- **Severity:** P2
- **Steps:** Profiler during cold start.
- **Expected:** Peak CPU ≤ 30%.
- **Pass criteria:** Same.
- **iOS reference:** N/A.

### TC-0366 — Network usage on Dashboard load
- **Area:** Performance
- **Type:** Performance
- **Severity:** P2
- **Steps:** Inspect Network Profiler while opening Dashboard.
- **Expected:** ≤ 3 parallel calls; combined payload < 200 KB.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0367 — Battery drain on idle paywall
- **Area:** Performance
- **Type:** Performance
- **Severity:** P2
- **Preconditions:** Paywall open 5 minutes idle.
- **Steps:** Use Battery Historian.
- **Expected:** No wake locks held; no continuous polling.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0368 — Polling stops when EmailSync screen leaves
- **Area:** Performance
- **Type:** Performance
- **Severity:** P1
- **Preconditions:** Sync polling active.
- **Steps:** Press back from EmailSyncScreen.
- **Expected:** OkHttp inspector shows zero further `/api/email/sync-stats` calls.
- **Pass criteria:** Same.
- **Known defect:** PARITY MATRIX P1 #32 — polling lifecycle stop MISSING.
- **iOS reference:** `.onDisappear` cancellation.

### TC-0369 — Image loading: receipt previews don't OOM
- **Area:** Performance
- **Type:** Edge / Performance
- **Severity:** P1
- **Preconditions:** Account with 50 receipt thumbnails.
- **Steps:** Scroll RecordsScreen.
- **Expected:** Coil downsamples; no OOM. Smooth scroll.
- **Pass criteria:** Same.
- **iOS reference:** Same.

### TC-0370 — Crash-free sessions ≥ 99%
- **Area:** Performance
- **Type:** Performance
- **Severity:** P0
- **Preconditions:** Internal testing population (≥ 50 testers).
- **Steps:** Monitor Play Console Vitals over 7 days.
- **Expected:** ANR rate < 0.5%, crash-free ≥ 99%.
- **Pass criteria:** Same.
- **iOS reference:** Same.

---

## End of test plan

Total numbered test cases: **TC-0001 — TC-0370**.

Top-priority blockers to verify first (lifted from PARITY_MATRIX critical defects):
1. Subscription paywall gate enforcement (TC-0263).
2. Subscription SKU naming alignment (TC-0267 to TC-0270).
3. `POST /api/subscription/verify` after Play purchase (TC-0271).
4. Real cancel-subscription implementation (TC-0276).
5. Promo code validate / activate wiring (TC-0277, TC-0278).
6. Payment history endpoint (TC-0279).
7. Restore Purchases on paywall (TC-0274, TC-0275).
8. `appauth` dependency / OAuth redirect resolution (TC-0317).
9. Demo Account button on LoginScreen (TC-0007).
10. Pending-status filter on transactions search (TC-0047).

If any of TC-0263, TC-0267-0271, TC-0274, TC-0276-0279, TC-0317 fail, **DO NOT submit the build to Google Play** — those are launch-blocking.
