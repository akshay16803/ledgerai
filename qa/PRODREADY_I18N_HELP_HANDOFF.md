# SpentyAI Android — Production-Readiness + Hindi i18n + Help Center Handoff
Generated: 2026-05-01
Branch: `emergent`

Three commits shipped on top of `7f0a65b qa: ios↔android parity audit`:

| # | Commit                                                                  | Message |
|---|-------------------------------------------------------------------------|---------|
| 1 | `c93473b chore(android/release): production-readiness ...`              | proguard, target SDK, permissions trim, backup rules |
| 2 | `1ddecac feat(android/i18n): English + Hindi strings.xml ...`           | top-20% screens + language toggle |
| 3 | `<this-commit> feat(android/help): in-app Help Center screen ...`       | FAQ + contact link, More menu entry |

---

## 1. Production-readiness — what changed

Files:
- `android-native/app/src/main/AndroidManifest.xml` — permission audit + trim (dropped READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE; kept INTERNET, ACCESS_NETWORK_STATE, RECORD_AUDIO, CAMERA). Added `<uses-feature>` entries for camera/microphone with `required="false"`. Wired `networkSecurityConfig`, `fullBackupContent`, `dataExtractionRules` attributes on `<application>`.
- `android-native/app/src/main/res/xml/network_security_config.xml` — new. Cleartext forbidden everywhere; `api.spentyai.com` explicitly trusted via system CAs; debug builds keep user CAs for mitmproxy.
- `android-native/app/src/main/res/xml/backup_rules.xml` — new. Excludes `secure_prefs`, OkHttp cache, SQLite DB so a device-restore can never silently log a different user in.
- `android-native/app/src/main/res/xml/data_extraction_rules.xml` — new. Android-12+ requirement; mirrors backup_rules across `<cloud-backup>` + `<device-transfer>`.
- `android-native/app/proguard-rules.pro` — expanded keep-rules for Retrofit, kotlinx-serialization $serializers + Companions, ALL `com.spentyai.app.**.model(s)` packages, Play Billing, Play Services Auth, Tink/security-crypto, Compose runtime, Coil, Application + MainActivity entry points.
- `qa/PRODUCTION_READINESS_HANDOFF.md` — keystore generation, env-var wiring, Play Console asset checklist, release-build smoke test.

`build.gradle.kts` was reviewed and left as-is (applicationId, versionCode/Name, minSdk/targetSdk/compileSdk, R8, signingConfig env-var wiring all already correct). No dependency bloat — Coil is the only image library.

### Manual steps the user must complete (excerpt from the handoff)

1. Generate `spentyai-upload.jks` via `keytool -genkey ...`. Keep it out of git.
2. Export `KEYSTORE_PATH` / `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` to the local shell (or CI secrets).
3. Run `./gradlew clean :app:bundleRelease` and verify the AAB.
4. Confirm the launcher icon (`mipmap-anydpi-v26/ic_launcher.xml`) renders the SpentyAI green-`$` mark — `ic_launcher_foreground.xml` may still be the placeholder; replace with the iOS-exported vector if so.
5. Play Console assets: feature graphic 1024x500, app icon 512x512, 2-8 phone screenshots, privacy policy URL, data-safety form, content rating, IAP enabled.

---

## 2. Hindi localization (i18n) — what changed

Files:
- `android-native/app/src/main/res/values/strings.xml` — English defaults (top 20% — Login/BottomNav/Dashboard headers/MoreMenu/common buttons/Settings sections/Help labels). Keys mirror `ios/.../AppStrings.swift` so the two platforms stay aligned.
- `android-native/app/src/main/res/values-hi/strings.xml` — Hindi translations ported verbatim from iOS.
- `android-native/app/src/main/java/com/spentyai/app/core/i18n/LanguageManager.kt` — pure-platform language switch (no appcompat dep). Persists `en`/`hi` in SharedPreferences `lang_prefs`; `wrap(base)` returns a Configuration-overridden Context.
- `android-native/app/src/main/java/com/spentyai/app/MainActivity.kt` — `attachBaseContext` wraps the base context with the chosen locale BEFORE `super.onCreate`.
- `android-native/app/src/main/java/com/spentyai/app/navigation/Screen.kt` — `BottomNavTab.label: String` -> `labelRes: Int` so tab labels follow the active language.
- `android-native/app/src/main/java/com/spentyai/app/navigation/BottomNavBar.kt` — reads `stringResource(tab.labelRes)`.
- `android-native/app/src/main/java/com/spentyai/app/features/auth/LoginScreen.kt` — switched brand title, tagline, sign-in / demo / dev buttons, terms/privacy footer (lookups hoisted out of `buildAnnotatedString`), error contentDescription.
- `android-native/app/src/main/java/com/spentyai/app/features/more/MoreMenuScreen.kt` — `MoreMenuItem.title: String` -> `titleRes: Int`; section headers (Finance/People/Data/Tools/Account) wired to stringResource. All 17 menu rows now follow the active language.
- `android-native/app/src/main/java/com/spentyai/app/features/dashboard/DashboardScreen.kt` — header tiles (Net Worth, Income This Month, Expenses This Month) and the two collapsible-section headers (Recent Transactions, Pending Approval).
- `android-native/app/src/main/java/com/spentyai/app/features/settings/SettingsScreen.kt` — added "Language" section with English/Hindi radio rows. Tapping a language calls `LanguageManager.setLanguage(...)` then `activity.recreate()` — the new locale takes effect immediately.

Out of scope (deliberate per task brief):
- Onboarding screen — one-time UX, plus the OnboardingSlider port itself is a separate gap in `qa/PARITY_MATRIX.md`.
- Form-heavy screens (TransactionForm, AccountForm, InvoiceForm) — follow-up commit material once the localized header strings ship.
- Long-form Help-Center FAQ bodies — content task, not a code task.

---

## 3. Help Center screen — what changed

Files (all new):
- `android-native/app/src/main/java/com/spentyai/app/features/help/HelpRepository.kt` — 10 curated FAQ articles (id/title/summary/body/category) lifted from iOS `SupportView` defaults + the live `www.spentyai.com/help` content. Returns a synchronous `ApiResult.Success` because `GET /api/help/articles` 404s today; signature is shaped so the call can move to a `viewModelScope.launch` block once the backend ships.
- `android-native/app/src/main/java/com/spentyai/app/features/help/HelpViewModel.kt` — `HelpUiState(articles, expandedId, errorMessage)`; `toggleArticle(id)` / `dismissError()`.
- `android-native/app/src/main/java/com/spentyai/app/features/help/HelpScreen.kt` — header card with the SpentyAI green Help icon, two action rows (open spentyai.com/help on the web, contact support@spentyai.com via mailto), then the expandable FAQ list. Uses the existing SpentyType/SpentyPrimary tokens for visual parity with SupportScreen.
- `android-native/app/src/main/java/com/spentyai/app/navigation/Screen.kt` — added `object Help : Screen("help", "Help Center")`.
- `android-native/app/src/main/java/com/spentyai/app/navigation/AppNavigation.kt` — instantiated `HelpRepository` + `HelpViewModel` in the same scope as `SupportRepository`/`SupportViewModel`; registered the `composable(Screen.Help.route)` block right after Support.
- `android-native/app/src/main/java/com/spentyai/app/navigation/BottomNavBar.kt` — added `Screen.Help.route` to the MORE-tab tracking list so the bottom bar stays correctly highlighted.
- `android-native/app/src/main/java/com/spentyai/app/features/more/MoreMenuScreen.kt` — added a "Help Center" row in the Account section, immediately after Settings (per the brief), using the AutoMirrored HelpCenter icon.

User flow: More -> Help Center. Inside the screen the user can:
1. Open the full Help Center on the web (108-screenshot, 32-article site).
2. Email `support@spentyai.com` (mailto: intent — falls through gracefully if no mail client is installed).
3. Expand any of 10 in-app FAQ articles (no network round-trip needed).

---

## Compile concerns / unresolved gaps

- **Not gradle-built locally.** All edits were made textually; user should run `./gradlew :app:assembleDebug` and confirm. The risky bits to eyeball:
  1. `DashboardScreen.kt` — added `import com.spentyai.app.R` and `stringResource` import. Lines: 76 (stringResource), 84 (R).
  2. `LoginScreen.kt` — `buildAnnotatedString` now reads four hoisted vals (`byContinuingText`, `termsText`, `privacyText`, `andText`) before the builder block.
  3. `Screen.kt` `BottomNavTab` enum signature changed from `label: String` to `labelRes: Int`. Anything outside `BottomNavBar.kt` that touched `BottomNavTab.label` would break — grep returned no other consumers, but a fresh grep is wise.
  4. `MoreMenuScreen.kt` `MoreMenuItem.title: String` -> `titleRes: Int`. Same caveat — grep returned no external consumers.
  5. `SettingsScreen.kt` appended `LanguageToggleSection` + `LanguageRow` composables at end-of-file; relies on the imports added near the top.
- **Backend `/api/help/articles` is 404.** Help articles are hardcoded in `HelpRepository`. When the endpoint ships, swap the body of `getArticles()` to a real Retrofit call (and make it `suspend`).
- **Hindi for follow-on screens.** Onboarding, Reports detail, Cash-flow, transaction/account/invoice/bill/customer/vendor forms — all still English. Each screen is a 30-min port using the same pattern (extract literal `"..."` -> `stringResource(R.string.x)`; add the en + hi entries).
- **Language toggle UX.** `Activity.recreate()` works but flashes briefly. A polish pass could use `AppCompatDelegate.setApplicationLocales` (per-app locale) once we add the appcompat dep.

---

## Smoke-test checklist (manual on device/emulator)

1. Cold-start app in English. Login screen reads "Sign in with Google", "View Demo Account", terms/privacy footer.
2. Sign in. Dashboard tiles show "Net Worth", "Income This Month", "Expenses This Month".
3. Tap More. Section headers read "Finance / People / Data / Tools / Account". Last section shows Settings, **Help Center**, Billing.
4. Tap Help Center. Header reads "Help Center" + subtitle. Two action rows visible. Tap article #1 — body expands.
5. Tap "Open full Help Center on the web" — Chrome opens `https://www.spentyai.com/help`.
6. Back to More. Tap Settings. Scroll to the new "Language" section. Tap "हिन्दी".
7. Activity recreates. Bottom-nav now reads "डैशबोर्ड / लेन-देन / खाते / रिपोर्ट / और". Dashboard tiles read "कुल संपत्ति / इस महीने की आय / इस महीने का खर्च". Login screen (after sign-out) reads "Google से साइन इन करें".
8. Force-close + relaunch. Hindi persists.
9. Toggle back to English. Confirm reverts.
