# Android Billing Fixes — Handoff (2026-05-01)

Fixed 6 critical Billing defects called out in `qa/PARITY_MATRIX.md`. All fixes
were committed individually to the `emergent` branch and pushed.

## Commits (oldest first)

| Hash      | Message |
|-----------|---------|
| `8af4ff8` | fix(android/billing): align SKU naming with iOS and query all 4 plans |
| `c400287` | fix(android/billing): POST /api/subscription/verify after Play purchase |
| `ee8bf7a` | fix(android/billing): open Play Store cancel link instead of no-op |
| `3569308` | fix(android/billing): wire promo validate + activate to backend |
| `2b4de06` | fix(android/billing): wire payment history to GET /api/payments/history |
| `5518db3` | fix(android/billing): user-driven Restore Purchases on paywall |

## Files changed

### `android-native/app/src/main/java/com/spentyai/app/features/billing/BillingViewModel.kt`

- L27–52: `BillingUiState` gained `isRestoringPurchases` and `restoreMessage`
  fields (Bug 6).
- L116–162: `queryProductDetails()` rewritten to query SUBS
  `com.spentyai.{monthly,quarterly,yearly}` and (separately) INAPP
  `com.spentyai.lifetime`, then merge results into the UiState (Bug 1).
- L164–181: `restorePurchases()` now iterates over both SUBS and INAPP product
  types (Bug 1).
- L183–229: New `restorePurchasesAction()` and `dismissRestoreMessage()` —
  user-driven restore that re-queries Play, acknowledges, calls `verifyPurchase`,
  refreshes status, and sets `restoreMessage` (Bug 6).
- L231–278: `purchaseSubscription()` now branches on
  `productDetails.productType`. SUBS sets `setOfferToken(...)`, INAPP omits it
  (Bug 1).
- L280–319: `handlePurchase()` calls `repository.verifyPurchase(purchase)` after
  acknowledging. Failures surface a non-fatal error and still reload status
  (Bug 2).
- L444–462: New `getCancelSubscriptionUrl()` — returns
  `https://play.google.com/store/account/subscriptions?sku=<productId>&package=<pkg>`
  (Bug 3).
- L464–474: New `refreshAfterCancelReturn()` (Bug 3).
- L476–483: `cancelSubscription()` reduced to dismissing the confirmation dialog;
  the actual Play deep-link is opened from the UI (Bug 3).

### `android-native/app/src/main/java/com/spentyai/app/features/billing/BillingRepository.kt`

- L3: New import `com.android.billingclient.api.Purchase` (Bug 2).
- L8–14: Added json helper imports (`JsonObject`, `JsonPrimitive`,
  `booleanOrNull`, `contentOrNull`, `doubleOrNull`).
- L106–109: `getHistory()` now hits `apiClient.endpoints.getPaymentHistory()` and
  maps each item via `jsonToPaymentOrder` (Bug 5).
- L111–115: `validatePromo()` now POSTs `{"code": code}` to
  `/api/promo/validate` and maps the result via `jsonToPromoResponse` (Bug 4).
- L117–121: `activatePromo()` mirrors validate against `/api/promo/activate`
  (Bug 4).
- L123–134: New private `jsonToPromoResponse(json)` helper (Bug 4).
- L136–146: New private `jsonToPaymentOrder(json)` helper (Bug 5).
- L148–158: New `verifyPurchase(purchase)` — POSTs
  `{platform, package_name, product_id, purchase_token, order_id}` to
  `/api/subscription/verify` (Bug 2).

### `android-native/app/src/main/java/com/spentyai/app/features/billing/BillingScreen.kt`

- L46: Added `import androidx.compose.ui.platform.LocalUriHandler` (Bug 3).
- L65: Added `val uriHandler = LocalUriHandler.current` (Bug 3).
- L96–110: Cancel-confirmation `Button` now opens
  `viewModel.getCancelSubscriptionUrl()` via `uriHandler.openUri(...)` and calls
  `refreshAfterCancelReturn()` (Bug 3).

### `android-native/app/src/main/java/com/spentyai/app/features/onboarding/SubscriptionPaywallScreen.kt`

- L49–50: Added `SnackbarHost`, `SnackbarHostState` imports (Bug 6).
- L91: Default `selectedProductId` flipped from `"spenty_yearly"` to
  `"com.spentyai.yearly"` to match the new SKU naming (Bug 1).
- L94: Added `val snackbarHostState = remember { SnackbarHostState() }` (Bug 6).
- L97–103: `LaunchedEffect(state.restoreMessage)` shows the restore result as
  a snackbar (Bug 6).
- L141: Scaffold gained `snackbarHost = { SnackbarHost(hostState = snackbarHostState) }`
  (Bug 6).
- L195–217: New OutlinedButton "Restore Purchases" inserted between the Continue
  button and the PromoSection. Disabled while restoring or purchasing; shows a
  spinner while in flight (Bug 6).
- TermsSection: removed the no-op text "Restore Purchases" link at the bottom
  (the new outlined button is the canonical entry point) (Bug 6).

### `android-native/app/src/main/java/com/spentyai/app/core/network/ApiEndpoints.kt`

- L587–593: Added `@POST api/promo/validate` and `@POST api/promo/activate`,
  both `@Body JsonObject -> Response<JsonObject>` (Bug 4).
- L595–597: Added `@GET api/payments/history -> Response<List<JsonObject>>`
  (Bug 5).

## Manual verification still needed

These cannot be confirmed in the sandbox (no gradle, no device):

1. **Compile** — `./gradlew :app:assembleDebug` and resolve any imports
   I might have missed. Most likely candidates: `LocalUriHandler` import
   path (used `androidx.compose.ui.platform.LocalUriHandler`), `JsonPrimitive`
   helpers (booleanOrNull / contentOrNull / doubleOrNull) — they live in
   `kotlinx.serialization.json.*`.
2. **Play Console** — Verify SKU IDs `com.spentyai.{monthly,quarterly,yearly}`
   exist as Subscriptions and `com.spentyai.lifetime` exists as a Managed
   Product. Without these set up in Play Console, queryProductDetails will
   return empty and the fallback static plans will continue to render.
3. **Backend** — confirm these endpoints accept the body shapes we send:
   - `POST /api/subscription/verify`
     `{ platform: "android", package_name, product_id, purchase_token, order_id? }`
   - `POST /api/promo/validate` and `POST /api/promo/activate` with `{ code }`
   - `GET /api/payments/history` returning a JSON array (server may currently
     only have `/api/payment-plans` — confirm or align).
4. **End-to-end purchase smoke test** on a real Android device with a Google
   Play test account:
   - Tap each plan card -> Play sheet opens (regression test for Bug 1).
   - Complete purchase -> server `/api/subscription/verify` is hit; status
     returns active on next reload (Bug 2).
   - Tap Cancel Subscription -> Play subscriptions URL opens (Bug 3).
   - Enter a known-good promo code -> Validate -> Activate -> status updates
     (Bug 4).
   - Open Payment History -> populated rows (Bug 5).
   - Tap Restore Purchases on paywall -> snackbar shows result; existing
     purchases are re-acknowledged + re-verified (Bug 6).
5. **Lifetime offer flow** — iOS has a separate `com.spentyai.lifetime_offer`
   countdown SKU that I did NOT add to Android. If the product spec wants
   parity with iOS Lifetime Offer (the time-limited variant), that's a
   follow-up.

## Out of scope

- Did not touch the iOS BillingViewModel or any iOS files.
- Did not introduce new dependencies — Play Billing 7.0.0 is already on
  `app/build.gradle.kts:123`.
- Did not implement the auto-paywall gate after login (parity matrix calls
  this out as a separate P0 — needs nav-graph changes).
- No Hindi localization for the new "Restore Purchases" / snackbar copy.
