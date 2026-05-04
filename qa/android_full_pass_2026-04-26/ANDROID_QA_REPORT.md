# SpentyAI Android QA Report

Date: 2026-04-26  
Device: Android emulator `emulator-5554`  
Build tested: `com.spentyai.app.debug`, version `1.0.0-debug`  
APK: `/Users/akshaychouhan/Desktop/ledgerai/android-native/app/build/outputs/apk/debug/app-debug.apk`

## Executive Summary

The Android app builds, installs, launches, and shows the unauthenticated Google sign-in screen. The major blocker is authentication/data connectivity: the Android client calls several API methods/paths that the production backend does not serve. Because of this, authenticated screens could not be tested as a real user without using a personal Google account against production data, which I intentionally did not do.

Most important findings:

- Android `POST /api/auth/google` returns `405`; backend expects `POST /api/auth/google/mobile`.
- Android `GET /api/auth/session` returns `404`; backend exposes `/api/auth/me`.
- API contract diff found 37 Android endpoint declarations that do not match backend method/path.
- Several visible authenticated UI routes/actions are wired to missing routes, placeholders, or empty callbacks.
- Google OAuth client id is still a TODO placeholder in Android resources.

## Evidence

Screenshots captured:

- Launch/login: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/screenshots/001_launch.png`
- Cancelled Google sign-in returns to login: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/screenshots/003_google_cancel_return.png`
- Terms link dispatches browser: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/screenshots/004_terms_link.png`
- Back to login after browser: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/screenshots/005_back_to_login_after_terms.png`

Logs and API evidence:

- Android/backend endpoint diff: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/logs/android_backend_endpoint_diff.txt`
- Google cancel logcat: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/logs/003_google_cancel_logcat.txt`
- API health: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/logs/api_health_body.txt`
- Android unit test output: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/logs/android_unit_tests.txt`
- Backend parser test output: `/Users/akshaychouhan/Desktop/ledgerai/qa/android_full_pass_2026-04-26/logs/backend_parser_1000.txt`

## Build And Runtime Results

| Check | Result | Notes |
|---|---:|---|
| Android debug build | Passed | `:app:assembleDebug` succeeded. Repo lacks `gradlew` and wrapper jar, so I used a local external Gradle wrapper jar. |
| Install on emulator | Passed | `adb install -r` succeeded. |
| Resolve launcher activity | Passed | `com.spentyai.app.debug/com.spentyai.app.MainActivity`. |
| App launch | Passed | Login screen displayed. |
| Google sign-in button | Partial | Opens Google account picker. I did not choose a personal account against production. Cancel returns to login. |
| Terms link | Passed with environment note | App dispatches `https://spentyai.com/terms`; emulator Chrome first-run appears. |
| Android unit tests | No source | Gradle task passed but reported `NO-SOURCE`. |
| Backend pytest suite | Blocked | Local Python has no `pytest`; functional tests also target live services and write data. |
| Backend parser script | Failed | `NameError: normalize_date is not defined` in `backend/tests/test_parser_1000.py`. |
| Production API health | Passed | `https://api.spentyai.com/api/health` returned `{"status":"ok","service":"SpentyAI API"}`. |

## Bugs

| ID | Severity | Area | Layman Explanation | Technical Evidence | Status | Screenshot / Evidence |
|---|---|---|---|---|---|---|
| BUG-001 | P0 | Login/API | Users likely cannot log in because the app asks the server for the wrong login URL. | Android uses `POST /api/auth/google`; production returns `405 Method Not Allowed`. Backend supports `POST /api/auth/google/mobile`. | Failed | `logs/api_auth_google_post_body.txt`, `screenshots/001_launch.png` |
| BUG-002 | P0 | Session/API | Even a saved login can be thrown away because the app checks a server route that does not exist. | Android uses `GET /api/auth/session`; production returns `404`. Backend exposes `GET /api/auth/me`. | Failed | `logs/api_auth_session_unauth_body.txt` |
| BUG-003 | P1 | Google OAuth | Google sign-in setup is unfinished, so a real user can be returned to login without a helpful reason. | `strings.xml` contains `YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com`; failures are logged in `MainActivity` but not shown to the user. | Failed / likely | `screenshots/003_google_cancel_return.png`, `logs/003_google_cancel_logcat.txt` |
| BUG-004 | P1 | Data Connection | Many app screens will hit server addresses that do not exist. | Contract diff: 155 Android endpoints, 209 backend routes, 37 Android declarations missing backend method/path. | Failed | `logs/android_backend_endpoint_diff.txt` |
| BUG-005 | P1 | More Menu | Tapping Cash Flow, Reconciliation, or SMS Sync can go nowhere or crash navigation. | More menu routes `cash_flow`, `reconciliation`, `sms_sync`; NavHost registers `mandates`, `statements`, and no SMS route. | Blocked by auth, static confirmed | Source: `MoreMenuScreen.kt`, `Screen.kt`, `AppNavigation.kt` |
| BUG-006 | P1 | Invoices/Purchases | The app shows create/upload/preview actions, but the buttons are wired to empty functions. | `AppNavigation.kt` passes empty callbacks to invoice and purchase screens. | Blocked by auth, static confirmed | Source: `AppNavigation.kt` |
| BUG-007 | P1 | Transactions | Tapping a transaction opens a placeholder with only the ID instead of transaction details. | `AppNavigation.kt` renders `PlaceholderScreen("Transaction: $id")`. | Blocked by auth, static confirmed | Source: `AppNavigation.kt` |
| BUG-008 | P1 | Customers/Vendors | Customer and vendor add/detail flows are visibly present but not actually connected. | Add callbacks are empty; detail routes render placeholders. | Blocked by auth, static confirmed | Source: `AppNavigation.kt` |
| BUG-009 | P1 | Payloads | Create/edit forms can fail because Android sends field names the backend does not expect. | Android raw `JsonObject` payloads use camelCase; backend expects snake_case for accounts/transactions. | Static confirmed | Source: `AccountFormScreen.kt`, `TransactionFormScreen.kt`, `server.py` |
| BUG-010 | P1 | Response Parsing | Lists may fail to load because Android expects raw arrays while backend returns wrapper objects. | Android expects `List<Invoice>`, `List<Bill>`, etc.; backend returns objects like `{items,total}`. | Static confirmed | Source: `ApiEndpoints.kt`, `server.py` |
| BUG-011 | P1 | Email Sync | Gmail/Outlook sync screens call `/api/email/gmail/*`, but backend uses `/api/gmail/*`. | `GET /api/email/gmail/status` returned `404`; `GET /api/gmail/status` returned auth-protected `401`. | Failed | `logs/api_android_mismatch_email_gmail_status_body.txt` |
| BUG-012 | P2 | Billing | Subscription buttons are visible, but purchase is not implemented. | `BillingViewModel.purchasePlan` is placeholder/coming-soon behavior. | Static confirmed | Source: `BillingViewModel.kt` |
| BUG-013 | P2 | Uploads | Several upload flows look available but cannot complete real upload/parse work. | Bill upload and other upload surfaces contain placeholder logic or empty callbacks. | Static confirmed | Source: `BillUploadScreen.kt`, `RecordsScreen.kt`, `ReconciliationScreen.kt` |
| BUG-014 | P2 | Security/Logs | Debug builds can leak sensitive API traffic into logs. | OkHttp BODY logging is enabled after Authorization header is added. | Static confirmed | Source: `ApiClient.kt` |
| BUG-015 | P2 | Tooling | A fresh developer cannot build from CLI because wrapper files are incomplete. | `gradle-wrapper.properties` exists, but no `gradlew` or `gradle-wrapper.jar`; `gradle` not in PATH. | Failed environment/tooling | Build notes |
| BUG-016 | P2 | Backend Tests | Existing backend parser test currently breaks before completing. | `python3 backend/tests/test_parser_1000.py` fails with `NameError: normalize_date is not defined`. | Failed | `logs/backend_parser_1000.txt` |

## Executed Test Cases

| ID | Area | Test Case | Type | Priority | Result | Evidence |
|---|---|---|---|---|---|---|
| EX-001 | Build | Assemble debug APK | Build | P0 | Passed | Gradle build succeeded |
| EX-002 | Install | Install debug APK on emulator | Emulator | P0 | Passed | `adb install` success |
| EX-003 | Launch | Resolve and start launcher activity | Emulator | P0 | Passed | `com.spentyai.app.MainActivity` |
| EX-004 | Login UI | Verify brand, tagline, Google button, legal footer render | Human UI | P0 | Passed | `screenshots/001_launch.png` |
| EX-005 | Login UI | Tap Google sign-in | Human UI | P0 | Partial | Account picker opened; personal account not selected |
| EX-006 | Login UI | Cancel Google sign-in | Human UI | P1 | Passed | Returned to login; log has `ApiException: 12501` |
| EX-007 | Legal | Tap Terms link | Human UI | P2 | Passed | Browser intent opened |
| EX-008 | API | Production health endpoint | Backend | P0 | Passed | `api_health_body.txt` |
| EX-009 | API | Android `POST /api/auth/google` | Backend contract | P0 | Failed | `405 Method Not Allowed` |
| EX-010 | API | Android `GET /api/auth/session` | Backend contract | P0 | Failed | `404 Not Found` |
| EX-011 | API | Android email sync route | Backend contract | P1 | Failed | `/api/email/gmail/status` returned `404` |
| EX-012 | Contract | Android vs backend route diff | Static/API | P0 | Failed | 37 mismatches |
| EX-013 | Unit Tests | Android unit test task | Automated | P1 | No tests | `NO-SOURCE` |
| EX-014 | Backend Tests | Parser stress script | Automated | P1 | Failed | `normalize_date` missing |

## Full Practical Test Matrix

These are the test cases that should exist for this app. Authenticated human-flow cases remain blocked until a disposable test account or staging token path is available.

| ID | Area | Test Case | Type | Priority | Expected Result | Status |
|---|---|---|---|---|---|---|
| TC-AUTH-001 | Auth | Fresh launch with no token | Human UI | P0 | Login screen appears | Passed |
| TC-AUTH-002 | Auth | Google button opens account picker | Human UI | P0 | Google account selection starts | Partial |
| TC-AUTH-003 | Auth | Complete Google login with test account | Human UI/API | P0 | User lands on Dashboard | Blocked |
| TC-AUTH-004 | Auth | Cancel Google login | Human UI | P1 | User returns to login cleanly | Passed |
| TC-AUTH-005 | Auth | Invalid/expired saved token | API/UI | P0 | Token cleared, login shown, user sees useful message | Blocked |
| TC-AUTH-006 | Auth | Session restore after force close | Human UI/API | P0 | Dashboard opens without re-login | Blocked |
| TC-AUTH-007 | Auth | Logout | Human UI/API | P0 | Local and server session both end | Blocked |
| TC-AUTH-008 | Auth | Delete account confirmation/cancel | Human UI/API | P0 | Cancel preserves account; confirm deletes data | Blocked |
| TC-AUTH-009 | Auth | No internet during login | Human UI/API | P1 | Clear offline message, no crash | Blocked |
| TC-AUTH-010 | Auth | OAuth failure | Human UI/API | P1 | User-visible error appears | Not run |
| TC-NAV-001 | Navigation | Bottom tab Dashboard | Human UI | P0 | Dashboard selected and content loads | Blocked |
| TC-NAV-002 | Navigation | Bottom tab Transactions | Human UI | P0 | Transaction list opens | Blocked |
| TC-NAV-003 | Navigation | Bottom tab Accounts | Human UI | P0 | Accounts list opens | Blocked |
| TC-NAV-004 | Navigation | Bottom tab Reports | Human UI | P0 | Reports screen opens | Blocked |
| TC-NAV-005 | Navigation | Bottom tab More | Human UI | P0 | More menu opens | Blocked |
| TC-NAV-006 | Navigation | Back behavior from detail screens | Human UI | P1 | Returns to previous screen without losing state | Blocked |
| TC-NAV-007 | Navigation | Deep/detail route with invalid ID | Human UI/API | P1 | Friendly not-found/error state | Blocked |
| TC-NAV-008 | Navigation | Rotate device on major screens | Human UI | P2 | Layout preserves state and does not overlap | Blocked |
| TC-DASH-001 | Dashboard | Load summary cards | Data UI | P0 | Balances, income, expense, net worth render | Blocked |
| TC-DASH-002 | Dashboard | Pull/trigger refresh | Human UI/API | P1 | Latest data replaces stale data | Blocked |
| TC-DASH-003 | Dashboard | Empty account state | Human UI | P1 | Helpful empty state and add action | Blocked |
| TC-DASH-004 | Dashboard | Recent transaction tap | Human UI | P0 | Real transaction detail opens | Blocked |
| TC-DASH-005 | Dashboard | Account tap | Human UI | P0 | Account detail opens | Blocked |
| TC-DASH-006 | Dashboard | AI chat shortcut | Human UI | P1 | AI chat opens | Blocked |
| TC-DASH-007 | Dashboard | Cash flow projection tap | Human UI | P1 | Cash flow/mandates view opens | Blocked |
| TC-DASH-008 | Dashboard | API 401/500/timeout | API/UI | P0 | Clear error and retry | Blocked |
| TC-TXN-001 | Transactions | Load first page | Data UI | P0 | Transactions list renders | Blocked |
| TC-TXN-002 | Transactions | Search transaction | Human UI/API | P1 | Matching results shown | Blocked |
| TC-TXN-003 | Transactions | Filter by type/status/account/category/date | Human UI/API | P1 | Correct filtered set | Blocked |
| TC-TXN-004 | Transactions | Create expense | Human UI/API | P0 | New expense saved and visible | Blocked |
| TC-TXN-005 | Transactions | Create income | Human UI/API | P0 | New income saved and balances update | Blocked |
| TC-TXN-006 | Transactions | Required field validation | Human UI | P0 | Inline errors, no bad request | Blocked |
| TC-TXN-007 | Transactions | Edit transaction | Human UI/API | P0 | Changes persist after reload | Blocked |
| TC-TXN-008 | Transactions | Delete transaction | Human UI/API | P0 | Confirm dialog, record removed | Blocked |
| TC-TXN-009 | Transactions | Approve/reject pending transaction | Human UI/API | P0 | Status updates and list refreshes | Blocked |
| TC-TXN-010 | Transactions | Recurring toggle | Human UI/API | P1 | Toggle persists | Blocked |
| TC-TXN-011 | Transactions | Infinite scroll/load more | Human UI/API | P1 | More rows load once | Blocked |
| TC-TXN-012 | Transactions | Very large/decimal amounts | Edge | P1 | Correct currency formatting and validation | Blocked |
| TC-ACCT-001 | Accounts | Load account list | Data UI | P0 | Accounts grouped and totals shown | Blocked |
| TC-ACCT-002 | Accounts | Create bank account | Human UI/API | P0 | Account saved | Blocked |
| TC-ACCT-003 | Accounts | Create liability/loan account | Human UI/API | P0 | Interest fields handled | Blocked |
| TC-ACCT-004 | Accounts | Edit account | Human UI/API | P0 | Changes persist | Blocked |
| TC-ACCT-005 | Accounts | Delete account with/without transactions | Human UI/API | P0 | Rules enforced, user warned | Blocked |
| TC-ACCT-006 | Accounts | Account detail transactions | Data UI | P0 | Related transactions visible | Blocked |
| TC-ACCT-007 | Accounts | Recalculate balance | API/UI | P1 | Balance recalculates, errors shown | Blocked |
| TC-ACCT-008 | Accounts | Sub-type manager CRUD | Human UI/API | P1 | Custom sub-types work | Blocked |
| TC-ACCT-009 | Accounts | Demat statement upload | Human UI/API | P1 | Upload parses or returns clear error | Blocked |
| TC-ACCT-010 | Accounts | OD interest view | API/UI | P2 | Interest calculation loads | Blocked |
| TC-REPORT-001 | Reports | Default report period loads | Data UI | P0 | Summary, period chart, category chart render | Blocked |
| TC-REPORT-002 | Reports | Custom date range | Human UI/API | P1 | Data reflects range | Blocked |
| TC-REPORT-003 | Reports | Income/expense category toggle | Human UI/API | P1 | Chart and list update | Blocked |
| TC-REPORT-004 | Reports | Export CSV | Human UI/API | P1 | File downloads/saves | Blocked |
| TC-REPORT-005 | Reports | Export PDF | Human UI/API | P1 | File downloads/saves | Blocked |
| TC-REPORT-006 | Reports | Empty reports | Human UI | P1 | Empty state, no crash | Blocked |
| TC-CASH-001 | Cash Flow | Open from More menu | Human UI | P0 | Cash flow screen opens | Blocked / static fail |
| TC-CASH-002 | Cash Flow | Projection chart loads | Data UI | P1 | Values and months visible | Blocked |
| TC-CASH-003 | Cash Flow | Mandates list | Data UI | P1 | Upcoming mandates shown | Blocked |
| TC-CASH-004 | Cash Flow | Detect mandate | API/UI | P1 | Detected mandates shown | Blocked |
| TC-REC-001 | Reconciliation | Open from More menu | Human UI | P0 | Reconciliation screen opens | Blocked / static fail |
| TC-REC-002 | Reconciliation | Upload statement | Human UI/API | P0 | Upload accepted and parsing status visible | Blocked / static fail |
| TC-REC-003 | Reconciliation | View statement detail | Human UI/API | P1 | Entries and match status visible | Blocked |
| TC-REC-004 | Reconciliation | Categorize/reconcile entries | Human UI/API | P1 | Changes persist | Blocked |
| TC-INV-001 | Invoices | Invoice list loads | Data UI | P0 | List or empty state renders | Blocked |
| TC-INV-002 | Invoices | Create invoice | Human UI/API | P0 | New invoice saved | Blocked / static fail |
| TC-INV-003 | Invoices | Edit invoice | Human UI/API | P0 | Changes persist | Blocked |
| TC-INV-004 | Invoices | Preview invoice | Human UI/API | P1 | Invoice preview opens | Blocked / static fail |
| TC-INV-005 | Invoices | Mark paid / record payment | Human UI/API | P0 | Status and balance update | Blocked / static fail |
| TC-INV-006 | Invoices | Delete invoice | Human UI/API | P0 | Confirm and delete | Blocked |
| TC-BILL-001 | Purchases | Bill list loads | Data UI | P0 | List or empty state renders | Blocked |
| TC-BILL-002 | Purchases | Create bill | Human UI/API | P0 | New bill saved | Blocked / static fail |
| TC-BILL-003 | Purchases | Upload bill photo/PDF | Human UI/API | P0 | Upload parses bill | Blocked / static fail |
| TC-BILL-004 | Purchases | Mark bill paid | Human UI/API | P0 | Status and balance update | Blocked |
| TC-BILL-005 | Purchases | Overdue bill badge | Data UI | P2 | Overdue state shown accurately | Blocked |
| TC-PEOPLE-001 | Customers | Customer list loads | Data UI | P0 | List or empty state renders | Blocked |
| TC-PEOPLE-002 | Customers | Add customer | Human UI/API | P0 | Customer saved | Blocked / static fail |
| TC-PEOPLE-003 | Customers | Customer detail | Human UI/API | P0 | Real detail opens | Blocked / static fail |
| TC-PEOPLE-004 | Customers | Edit/delete customer | Human UI/API | P0 | Changes persist | Blocked |
| TC-PEOPLE-005 | Vendors | Vendor list loads | Data UI | P0 | List or empty state renders | Blocked |
| TC-PEOPLE-006 | Vendors | Add vendor | Human UI/API | P0 | Vendor saved | Blocked / static fail |
| TC-PEOPLE-007 | Vendors | Vendor detail | Human UI/API | P0 | Real detail opens | Blocked / static fail |
| TC-CAT-001 | Categories | Category list loads | Data UI | P1 | Income/expense tabs render | Blocked |
| TC-CAT-002 | Categories | Create category/subcategory | Human UI/API | P1 | Category saved | Blocked |
| TC-CAT-003 | Categories | Edit/delete category | Human UI/API | P1 | Rules enforced | Blocked |
| TC-CAT-004 | Categories | Load defaults | Human UI/API | P1 | Default categories seeded | Blocked |
| TC-DATA-001 | Email Sync | Gmail status | API/UI | P0 | Status loads | Failed contract |
| TC-DATA-002 | Email Sync | Gmail connect | Human UI/API | P0 | OAuth URL opens | Blocked / contract risk |
| TC-DATA-003 | Email Sync | Outlook status/connect | Human UI/API | P0 | Status/OAuth works | Blocked / contract risk |
| TC-DATA-004 | Email Sync | Pending review list | Data UI | P0 | Transactions requiring review show | Blocked |
| TC-DATA-005 | Email Sync | Bulk approve/reject | Human UI/API | P1 | Selected items update | Blocked |
| TC-DATA-006 | SMS Sync | Open SMS Sync | Human UI | P0 | Screen opens and permission/status shown | Blocked / static fail |
| TC-DATA-007 | SMS Sync | Permission flow | Human UI | P0 | Android permission handled | Blocked |
| TC-DATA-008 | SMS Sync | Upload/parse SMS batch | API | P0 | Messages stored/deduped | Not run |
| TC-DATA-009 | Records | Email archive list | Data UI | P1 | Records list loads | Blocked / contract risk |
| TC-DATA-010 | Records | Record preview | Human UI/API | P1 | EML/body/attachments visible | Blocked |
| TC-DATA-011 | Records | Attachment download | Human UI/API | P1 | Attachment opens/saves | Blocked / contract risk |
| TC-DATA-012 | Receipts | Receipt list/download/delete | Human UI/API | P1 | Actions persist | Blocked |
| TC-AI-001 | AI Chat | Open chat | Human UI | P1 | Chat opens | Blocked |
| TC-AI-002 | AI Chat | Send bookkeeping question | Human UI/API | P1 | Response appears | Blocked / contract risk |
| TC-AI-003 | AI Chat | Suggested prompts | Human UI/API | P2 | Suggestions load | Blocked |
| TC-AI-004 | AI Chat | Clear history | Human UI/API | P2 | Server history clears | Blocked / static fail |
| TC-SUPPORT-001 | Support | FAQ loads | Data UI | P2 | FAQ visible | Blocked |
| TC-SUPPORT-002 | Support | Submit support ticket | Human UI/API | P1 | Ticket created | Blocked / contract risk |
| TC-FEAT-001 | Feature Requests | List requests | Data UI | P2 | Requests visible | Blocked |
| TC-FEAT-002 | Feature Requests | Submit request | Human UI/API | P2 | Request created | Blocked |
| TC-SET-001 | Settings | Load settings | Data UI | P0 | Business/currency/profile data visible | Blocked |
| TC-SET-002 | Settings | Update business profile | Human UI/API | P1 | Changes persist | Blocked |
| TC-SET-003 | Settings | Currency/locale update | Human UI/API | P1 | Currency/date format affects UI | Blocked |
| TC-SET-004 | Settings | Upload logo/signature | Human UI/API | P2 | File uploads | Blocked / static fail |
| TC-BILLING-001 | Billing | View plans/status | Data UI | P0 | Plan/status shown | Blocked / contract risk |
| TC-BILLING-002 | Billing | Start subscription | Human UI/API | P0 | Play Billing flow starts | Blocked / static fail |
| TC-BILLING-003 | Billing | Payment history | Data UI | P1 | Orders listed | Blocked |
| TC-OFFLINE-001 | Offline | Launch without network | Human UI | P1 | Cached/login state handled | Not run |
| TC-OFFLINE-002 | Offline | API timeout on lists | API/UI | P1 | Retry/error state, no crash | Not run |
| TC-OFFLINE-003 | Offline | Reconnect after error | Human UI/API | P1 | Refresh succeeds | Not run |
| TC-ACCESS-001 | Accessibility | TalkBack labels on nav/buttons | Accessibility | P1 | Critical controls labeled | Not run |
| TC-ACCESS-002 | Accessibility | Font scaling large | Accessibility | P1 | Text does not overlap/truncate badly | Not run |
| TC-ACCESS-003 | Accessibility | Contrast/dark mode | Accessibility | P2 | Text readable | Not run |
| TC-PERF-001 | Performance | Cold launch time | Perf | P2 | Launch under agreed threshold | Not run |
| TC-PERF-002 | Performance | Large transaction list scroll | Perf | P2 | Smooth scroll, no ANR | Not run |
| TC-SEC-001 | Security | No tokens in debug/prod logs | Security | P0 | Sensitive headers/body not logged | Static fail in debug |
| TC-SEC-002 | Security | Protected endpoints reject unauth | API | P0 | 401 returned | Partially passed |
| TC-SEC-003 | Security | Cleartext traffic | Security | P1 | HTTP blocked | Static passed |

## Untestable / Unreachable Gaps

| Gap ID | Area | Observation | QA Disposition |
|---|---|---|---|
| GAP-001 | Cash Flow | More menu navigates to `cash_flow`, but the registered route is `mandates`. | Treat as P0 navigation defect. |
| GAP-002 | Reconciliation | More menu navigates to `reconciliation`, but the registered route is `statements`. | Treat as P0 navigation defect. |
| GAP-003 | SMS Sync | More menu has `sms_sync`, but no route/screen is registered. | Remove row or implement route/screen before QA. |
| GAP-004 | Transaction Detail | `transaction/{id}` renders a placeholder even though `TransactionDetailScreen.kt` exists. | Row-tap detail testing blocked. |
| GAP-005 | Invoices | Create, preview, and record-payment callbacks are empty; invoice detail is placeholder. | Invoice workflow blocked through UI. |
| GAP-006 | Purchases/Bills | New bill, upload, preview, and payment callbacks are empty; bill detail is placeholder. | Bill workflow blocked through UI. |
| GAP-007 | Customers/Vendors | Add callbacks are empty and detail routes are placeholders. | People CRUD blocked through UI. |
| GAP-008 | Account Sub-Types | Account list sub-type manager callback is empty despite a screen existing. | Sub-type CRUD blocked through UI. |
| GAP-009 | Uploads | Reconciliation, records receipts, settings logo/signature, demat, and bill upload surfaces are placeholder/incomplete. | Upload workflows should fail until wired. |
| GAP-010 | Email OAuth | Android stores OAuth URL but route/path wiring does not match backend and visible launch path is risky. | OAuth connect blocked by contract/UI gap. |
| GAP-011 | Billing | Subscribe action is intentionally “coming soon.” | Play Billing sandbox testing blocked. |
| GAP-012 | Past Insights | Repository appears to return placeholder/fake data for some flows. | Treat as placeholder until backend contract exists. |
| GAP-013 | Settings Reset | Reset-data flow does not clearly call backend `/api/settings/reset-data`. | Needs contract fix and destructive-data staging tests. |
| GAP-014 | Placeholder Routes | `profile`, `subscription`, `payment_plans`, invoice detail, bill detail, customer detail, and vendor detail are placeholders or hidden. | Exclude from pass criteria until implemented. |

## Recommended Additional QA Work

1. Create a disposable staging Google account and seeded staging backend. This is required to finish real human-flow testing safely.
2. Add a debug-only simulator login path in Android that calls `/api/auth/dev/simulator-login` only for non-production builds.
3. Generate an OpenAPI spec from FastAPI and add Android contract tests to catch path, method, payload, and response-shape mismatches in CI.
4. Add Maestro or Espresso end-to-end tests for login, navigation, transaction CRUD, account CRUD, invoice/bill CRUD, email sync, and records.
5. Add snapshot/accessibility checks for large font, dark mode, small screens, rotation, and TalkBack labels.
6. Add network-condition tests: offline launch, DNS failure, slow API, 401 token expiry, 500 response, and retry behavior.
7. Add Play Billing sandbox tests before exposing subscription purchase buttons.
8. Add security checks that debug/prod logs never include Authorization tokens, PII, or full request/response bodies.
9. Add backend fixtures that do not mutate production and avoid tests that depend on `mongosh` on the developer machine.
10. Add crash/ANR monitoring and a nightly device matrix across API 24, 29, 34, and 36.

## Final Testing Status

The app is not ready for a full user-facing Android QA sign-off yet. Build/install/launch are healthy, but auth and API contracts need to be fixed first; otherwise most authenticated frontend tests are blocked or would fail immediately at login/data loading.
