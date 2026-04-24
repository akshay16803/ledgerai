# Domain C — Dashboard, Cash Flow, Mandates, and Reports

**Target build:** SpentyAI iOS (emergent branch)
**Test date baseline:** 2026-04-24 (so "this month" = April 2026, "next month" / May projection = May 2026)
**Scope:** Dashboard, Cash Flow (including projection + monthly calendar), Mandates, Recurring, Reports (summary / period / category / income-expense / CSV / PDF), Past Insights (tax summaries)

---

## Global invariant under test (must hold for every calculation case)

**ONLY rows with `status == "approved"` (transactions) or `status == "active"` (mandates) may contribute to any number the user sees on Dashboard, Cash Flow, or Reports.**

- `pending_review` transactions: MUST NOT appear in Net Worth, Income MTD, Expense MTD, Savings, Cash Flow projection, any Report total, any category breakdown, any period bucket, any chart bar, any donut slice, or CSV/PDF export rows.
- `paused` / `cancelled` mandates: MUST NOT appear in Cash Flow projection, monthly calendar, dashboard next-month tile, or any mandate-derived total.
- The ONLY place pending rows may be visible is the "Pending Approval" stat card count (`pendingReview`), the pending review banner, and the dedicated pending-review list.

If this invariant fails in any test case, the bug is at minimum **P0 / Critical** (user sees a wrong balance → loss of trust → we are lying with numbers). This is called out explicitly per-test where applicable.

---

## Seed dataset reference (used by math cases)

Where tests say "seed dataset A", the user has been provisioned with:

| Row | Type | Amount | Date | Status | Notes |
|-----|------|--------|------|--------|-------|
| T1  | income | 120,000 | 2026-04-01 | approved | Salary |
| T2  | expense | 25,000 | 2026-04-03 | approved | Rent |
| T3  | expense | 4,500 | 2026-04-10 | approved | Groceries |
| T4  | expense | 1,299 | 2026-04-12 | approved | Fuel |
| T5  | income | 8,000 | 2026-04-15 | approved | Freelance |
| T6  | expense | 50,000 | 2026-04-20 | **pending_review** | Email-parsed, should NOT count |
| T7  | expense | 999 | 2026-03-31 | approved | Prior month — excluded from MTD |
| T8  | income | 50,000 | 2027-05-01 | approved | Future year — excluded from MTD |
| T9  | transfer | 10,000 | 2026-04-18 | approved | Between accounts — neutral |

Account seeds:
- A1: savings balance ₹4,00,000 (asset)
- A2: credit card balance ₹35,000 (liability)
- A3: investment balance ₹1,50,000 (investment)
- A4: home loan balance ₹12,00,000 (liability), `loan_emi_amount=18500`, `loan_emi_day=5`
- A5: overdraft balance ₹50,000 (liability, sub_type=overdraft), `loan_interest_rate=12`

Mandate seeds:
- M1: Netflix, ₹649, monthly, debit_day=10, status=active
- M2: AWS, USD 29, monthly, debit_day=15, status=active, base_currency=INR
- M3: Medium, ₹400, monthly, debit_day=22, status=**paused** (excluded)
- M4: OldGym, ₹1,500, monthly, debit_day=1, status=**cancelled** (excluded)

**Expected Dashboard math from seed A (base = INR):**
- Total Assets = 400,000 + 150,000 = ₹5,50,000
- Total Liabilities = 35,000 + 12,00,000 + 50,000 = ₹12,85,000
- Net Worth = 5,50,000 − 12,85,000 = **−₹7,35,000**
- Income MTD = 120,000 + 8,000 = **₹1,28,000** (T8 future excluded)
- Expense MTD = 25,000 + 4,500 + 1,299 = **₹30,799** (T6 pending excluded, T7 prior month excluded)
- Savings MTD = 128,000 − 30,799 = **₹97,201**
- Pending count = **1** (T6)

---

# Dashboard test cases

### C01 — Dashboard loads after sign-in with seed dataset A
**Priority:** P0
**Pre-conditions:** Fresh install, user signed in, seed A provisioned on backend.
**Steps:**
1. Launch app → land on Dashboard.
2. Wait for network fetch to complete.
**Expected result:** Four stat cards render: Net Worth = −₹7,35,000, Income (Apr) = ₹1,28,000, Expenses (Apr) = ₹30,799, Pending Approval = 1. Recent transactions section lists up to 10 approved txns sorted by date desc. No crash. No error banner.
**Bug severity if fails:** Critical — P0.

### C02 — Net Worth math: assets minus liabilities, negative allowed
**Priority:** P0
**Pre-conditions:** Seed A.
**Steps:**
1. Open Dashboard.
2. Read Net Worth card value.
3. Open Accounts screen and sum (assets + investments) − (liabilities) by hand.
**Expected result:** Card value equals −₹7,35,000 and matches hand-computed total to the rupee. Card icon tint is `spentyError` because value < 0.
**Bug severity if fails:** Critical — P0. Users lose trust if net worth is wrong.

### C03 — Net Worth math: positive case, tint flips to success
**Priority:** P0
**Pre-conditions:** Seed A but A4 (home loan) deleted so liabilities = 35,000 + 50,000 = 85,000 and net worth = 5,50,000 − 85,000 = 4,65,000.
**Steps:** Open Dashboard.
**Expected result:** Net Worth card = ₹4,65,000, icon tint is `spentySuccess` (green).
**Bug severity if fails:** Major — P1.

### C04 — Income MTD excludes prior-month and future-year rows
**Priority:** P0
**Pre-conditions:** Seed A (includes T7 March row and T8 2027 row).
**Steps:** Open Dashboard, read Income card.
**Expected result:** ₹1,28,000 exactly. T7 (March) and T8 (2027) NOT counted.
**Bug severity if fails:** Critical — P0. Off-by-one on month boundary is a frequent real-world bug.

### C05 — Expense MTD strictly excludes pending_review rows
**Priority:** P0
**Pre-conditions:** Seed A includes T6 = ₹50,000 expense in `pending_review`.
**Steps:**
1. Open Dashboard, note Expense MTD = ₹30,799.
2. Via debug menu or backend, confirm T6 exists with `status=pending_review`.
3. Pull-to-refresh.
**Expected result:** Expense card STILL ₹30,799. The pending ₹50,000 must NOT inflate expenses. Pending Approval card reads 1.
**Bug severity if fails:** Critical — P0. This is the headline user-feedback rule.

### C06 — Savings rate / savings this month
**Priority:** P1
**Pre-conditions:** Seed A.
**Steps:** Open Dashboard and, if a Savings card or Savings row is rendered in the income/expense summary tile, verify it.
**Expected result:** savings_this_month = ₹97,201 (= 128,000 − 30,799). If the view renders savings rate (%) = savings / income, value = 75.94%.
**Bug severity if fails:** Major — P1.

### C07 — Pending Approval card count reflects ONLY pending-review txns
**Priority:** P0
**Pre-conditions:** Seed A (one pending_review) plus three additional pending_review rows added.
**Steps:**
1. Open Dashboard; read Pending Approval card.
**Expected result:** Card = 4. Tapping card opens pending list showing all 4 rows. Approving one drops count to 3 and moves the row into Expense MTD on next refresh.
**Bug severity if fails:** Critical — P0.

### C08 — Approving a pending txn updates Expense MTD on refresh
**Priority:** P0
**Pre-conditions:** Seed A with T6 pending ₹50,000 expense dated 2026-04-20.
**Steps:**
1. Open Dashboard → note Expense MTD = ₹30,799.
2. Tap Pending Approval card.
3. Approve T6.
4. Go back to Dashboard, pull-to-refresh.
**Expected result:** Expense MTD now = ₹80,799. Pending Approval card now 0. Net Worth unchanged (transfers-only affect accounts, pending->approved of an expense doesn't move account balance unless reconciliation links it — verify based on backend behaviour).
**Bug severity if fails:** Critical — P0.

### C09 — Rejecting a pending txn has no effect on totals
**Priority:** P0
**Pre-conditions:** Seed A.
**Steps:** Open Dashboard → Pending list → reject T6 → refresh Dashboard.
**Expected result:** Expense MTD still ₹30,799. Pending card now 0. T6 no longer in any list.
**Bug severity if fails:** Critical — P0.

### C10 — Recent transactions shows up to 10 approved, newest first
**Priority:** P1
**Pre-conditions:** User has 15 approved transactions spanning a week, plus 3 pending_review rows inserted BETWEEN the approved ones by date.
**Steps:** Open Dashboard → scroll to Recent Transactions.
**Expected result:** Exactly 10 rows shown (per `Array(approved.prefix(10))`). All 10 rows have status approved (no pending). Sort is by date desc. Pending rows do NOT appear here.
**Bug severity if fails:** Major — P1.

### C11 — Empty dashboard: zero accounts, zero txns
**Priority:** P1
**Pre-conditions:** Brand new user, no accounts, no txns.
**Steps:** Sign in → Dashboard loads.
**Expected result:** Net Worth = ₹0 (green tint because 0 is not <0), Income/Expense/Pending all 0, Recent Transactions section hidden or shows `EmptyStateView` with CTA. No crash. No NaN/null displayed.
**Bug severity if fails:** Major — P1.

### C12 — Skeleton / loading state on first load
**Priority:** P2
**Pre-conditions:** Throttle network to 3G (or use Network Link Conditioner).
**Steps:** Cold-launch app → observe Dashboard screen during fetch.
**Expected result:** `LoadingView(message:"Loading your dashboard…")` shown while `viewModel.isLoading && !viewModel.hasData`. Once data arrives, main content replaces it with no flash of empty grid.
**Bug severity if fails:** Minor — P2.

### C13 — Pull-to-refresh reloads all four stats AND pending AND projection
**Priority:** P0
**Pre-conditions:** Seed A. Dashboard already loaded.
**Steps:**
1. On backend, insert a new approved expense T10 = ₹5,000 dated today.
2. Pull down on Dashboard to trigger refresh.
**Expected result:** `.refreshable` fires `viewModel.refresh()` → Expense MTD becomes ₹35,799, Pending count unchanged, Net Worth unchanged, next-month projection tile re-fetched. Spinner disappears when all three finish.
**Bug severity if fails:** Critical — P0 (freshness is a user-facing promise).

### C14 — Auto-refresh on app foreground
**Priority:** P2
**Pre-conditions:** App in background for 5+ minutes. On backend, add a new approved income = ₹10,000 today.
**Steps:** Foreground the app.
**Expected result:** Dashboard either auto-refreshes OR shows a subtle cue. If auto-refresh is implemented, Income MTD should update to reflect the new ₹10,000 without user pull.
**Bug severity if fails:** Minor — P2 (nice-to-have, document current behavior).

### C15 — Currency: switch base currency (INR → USD) and every card re-renders
**Priority:** P0
**Pre-conditions:** Seed A, base_currency = INR. Then change base to USD via Settings. Assume backend converts balances.
**Steps:**
1. Settings → change base currency USD.
2. Return to Dashboard → pull-to-refresh.
**Expected result:** All four cards show `$` prefix, not `₹`. Values are USD-converted amounts (from backend). No leftover ₹ anywhere. Recent transactions list and next-month projection tile also update.
**Bug severity if fails:** Critical — P0 if mixed symbols appear.

### C16 — Currency: abbreviation thresholds ₹1K / ₹1L / ₹1Cr
**Priority:** P1
**Pre-conditions:** Seed A modified so Net Worth = ₹1,23,45,67,890.
**Steps:** Open Dashboard.
**Expected result:** Card shows abbreviated form if enabled (e.g. 123.46Cr) matching `abbreviatedAmount`. No scientific notation, no "inf".
**Bug severity if fails:** Minor — P2.

### C17 — Localization: switch to Hindi and every label translates
**Priority:** P0
**Pre-conditions:** Seed A, English.
**Steps:** Tap `EN/हिंदी` toggle in top toolbar.
**Expected result:** Navigation title "Dashboard" → "डैशबोर्ड". Cards: "Net Worth" → "कुल संपत्ति", "Income This Month" → "इस महीने की आय", "Expenses This Month" → "इस महीने का खर्च", "Pending Approval" → "अनुमोदन लंबित". Numbers remain in Indian numeral grouping. No English fallback strings.
**Bug severity if fails:** Major — P1.

### C18 — Localization: date format in recent transactions
**Priority:** P1
**Pre-conditions:** Hindi mode.
**Steps:** Inspect date strings in Recent Transactions.
**Expected result:** Dates use Hindi locale (e.g. "अप्रै 24" or device locale's Hindi). Toggle back → English "Apr 24".
**Bug severity if fails:** Minor — P2.

### C19 — Dark mode on every card and chart
**Priority:** P1
**Pre-conditions:** iOS Settings → Appearance = Dark.
**Steps:** Open Dashboard; inspect every card, icon, chart, divider.
**Expected result:** Card background is `spentyBgElevated` dark; text uses `spentyTextPrimary` with sufficient contrast (WCAG AA ≥ 4.5:1 on body text). No white-on-white, no invisible dividers. Success/Error tints remain discernible against dark background.
**Bug severity if fails:** Major — P1.

### C20 — Accessibility: VoiceOver reads every stat card
**Priority:** P1
**Pre-conditions:** VoiceOver on.
**Steps:** Swipe through Dashboard.
**Expected result:** Each stat card is a single accessible element announcing "{label}, {value}" (e.g. "Net Worth, minus seven lakh thirty-five thousand rupees"). Tapping activates drill-down. Pending card also reads "Pending Approval, 1".
**Bug severity if fails:** Major — P1.

### C21 — Accessibility: Dynamic Type scaling
**Priority:** P2
**Pre-conditions:** Settings → Accessibility → Larger Text → max.
**Steps:** Open Dashboard.
**Expected result:** Labels and values scale without truncation or clipping. No overlapping cards.
**Bug severity if fails:** Minor — P2.

### C22 — Performance: 1,000+ approved transactions
**Priority:** P1
**Pre-conditions:** Seed a user with 1,500 approved transactions spanning 12 months.
**Steps:** Cold-launch app → land on Dashboard.
**Expected result:** Dashboard paints full content ≤ 2.0 s on iPhone 14 on WiFi. No dropped frames in Instruments. Recent transactions still only 10 rows (bounded).
**Bug severity if fails:** Major — P1.

### C23 — Edge: transaction at last second of month boundary
**Priority:** P0
**Pre-conditions:** Insert T11 = approved expense ₹1,234 with `date = "2026-04-30"` (last day of April) and T12 = approved expense ₹9,999 with `date = "2026-05-01"`.
**Steps:** On 2026-04-24 open Dashboard.
**Expected result:** T11 INCLUDED in Expense MTD (April). T12 EXCLUDED from April MTD.
**Bug severity if fails:** Major — P1. Month-boundary bugs are a classic off-by-one.

### C24 — Edge: transaction date in far future (2027) never counts in MTD
**Priority:** P0
**Pre-conditions:** Seed A includes T8 (2027-05-01 income ₹50,000).
**Steps:** Open Dashboard.
**Expected result:** Income MTD = ₹1,28,000 (excludes T8). Net Worth also unaffected unless the txn has moved an account balance — verify account balance logic separately.
**Bug severity if fails:** Critical — P0.

### C25 — Edge: transfer transactions are neutral to income/expense cards
**Priority:** P0
**Pre-conditions:** Seed A (T9 is a ₹10,000 transfer).
**Steps:** Verify Income and Expense cards.
**Expected result:** Neither card includes ₹10,000 transfer. Transfer affects only account balances, not income/expense.
**Bug severity if fails:** Critical — P0.

### C26 — Dashboard stat card tap → drill-down list
**Priority:** P1
**Pre-conditions:** Seed A.
**Steps:** Tap Income card → see sheet titled "Income" with filtered recent-month income txns; tap Expense card likewise; tap Net Worth → Accounts list; tap Pending → pending review list.
**Expected result:** Each drill-down shows exactly the transactions counted in the corresponding stat — no stray pending rows, no prior-month rows in the MTD lists.
**Bug severity if fails:** Major — P1.

### C27 — Pending review banner shown when pendingReview > 0
**Priority:** P1
**Pre-conditions:** Seed A with 1 pending row.
**Steps:** Open Dashboard.
**Expected result:** Pending banner or stat card highlights "1 transaction awaiting your approval". Tapping opens pending list. When count = 0, the banner is hidden entirely.
**Bug severity if fails:** Minor — P2.

### C28 — Next-month projection tile on Dashboard
**Priority:** P1
**Pre-conditions:** Seed A with mandates M1 (₹649) + M2 (USD 29 ≈ ₹2,400) and EMI A4 (₹18,500) active.
**Steps:** Open Dashboard; read Next-Month Projection tile.
**Expected result:** Tile shows projected May 2026 total outflow = recurring expense + mandate expense (649 + ~2,400) + EMI (18,500) + OD interest (computed dynamically). Paused M3 and cancelled M4 excluded. Value = `nextMonthTotalOutflow` from `DashboardViewModel`.
**Bug severity if fails:** Major — P1.

### C29 — Projection tile when CashFlow endpoint fails: graceful fallback
**Priority:** P1
**Pre-conditions:** Kill network mid-load or force 500 on `/api/cashflow/projection`.
**Steps:** Open Dashboard.
**Expected result:** Four stat cards still render from `/api/dashboard/summary`. Projection tile either hidden (`hasProjectionData=false`) or shows "–" with no error banner (non-fatal per viewModel).
**Bug severity if fails:** Major — P1.

### C30 — Pending deep-link: notification → pending list
**Priority:** P2
**Pre-conditions:** Pending txn exists; push notification fires.
**Steps:** Tap notification.
**Expected result:** App opens directly to pending list; Dashboard still accurate after back-nav.
**Bug severity if fails:** Minor — P2.

---

# Past Insights / Tax Summary test cases

### C31 — Past Insights list loads
**Priority:** P1
**Pre-conditions:** User has 3 saved tax summaries on backend.
**Steps:** Open Past Insights tab.
**Expected result:** All 3 summaries listed with name, date range, totalIncome, totalExpenses, net. Newest at top.
**Bug severity if fails:** Major — P1.

### C32 — Past Insight detail shows transactions
**Priority:** P1
**Pre-conditions:** Summary S1 has 42 linked transactions.
**Steps:** Tap S1 → detail opens.
**Expected result:** Detail header shows summary totals. Below it, 42 txn rows (date, description, amount, type, category). `isLoadingTransactions` spinner shows briefly.
**Bug severity if fails:** Major — P1.

### C33 — Regenerate summary after creating
**Priority:** P1
**Pre-conditions:** No existing summary for FY 2025-26.
**Steps:** Past Insights → + Create → fill name "FY25-26", dateFrom=2025-04-01, dateTo=2026-03-31, pick email → Save.
**Expected result:** New summary appears at top. Backend generates totals (India FY runs April → March). After generation completes, detail shows populated totals.
**Bug severity if fails:** Major — P1.

### C34 — Export CSV from a past insight
**Priority:** P2
**Pre-conditions:** S1 detail open.
**Steps:** Tap Export → CSV.
**Expected result:** Share sheet opens with `{name}.csv`. CSV contains all 42 transactions with headers date,description,amount,type,category.
**Bug severity if fails:** Minor — P2.

### C35 — Delete a past insight
**Priority:** P1
**Pre-conditions:** 3 summaries.
**Steps:** Swipe delete on one → confirm.
**Expected result:** Summary removed from list. Backend `DELETE /api/tax-summary/{id}` returns 200.
**Bug severity if fails:** Major — P1.

### C36 — Past Insights with zero summaries
**Priority:** P2
**Pre-conditions:** No saved summaries.
**Steps:** Open Past Insights.
**Expected result:** Empty-state copy with CTA "Create your first tax summary". No crash.
**Bug severity if fails:** Minor — P2.

### C37 — Past Insights: add manual transaction to a summary
**Priority:** P2
**Pre-conditions:** Detail view of S1 open.
**Steps:** Tap +Add Transaction → fill date, description, amount, type=expense, category → Save.
**Expected result:** Txn prepended to detailTransactions list; backend stores it linked to S1 id.
**Bug severity if fails:** Minor — P2.

---

# Cash Flow test cases

### C38 — Cash Flow loads projection + mandates + recurring + upcoming concurrently
**Priority:** P0
**Pre-conditions:** Seed A.
**Steps:** Open Cash Flow tab.
**Expected result:** `CashFlowViewModel.loadAll()` fires 4 parallel requests. Screen shows monthly summary tiles (income, expense, mandates, EMI, OD interest, net) populated within 2s on WiFi.
**Bug severity if fails:** Critical — P0.

### C39 — Projection math with seed A (to the rupee)
**Priority:** P0
**Pre-conditions:** Seed A. No recurring transactions flagged (`is_recurring=false` on all). Mandates: M1 ₹649 active, M2 USD29 active, M3 paused, M4 cancelled. EMI A4 ₹18,500. OD interest computed dynamically from A5.
**Steps:**
1. Open Cash Flow.
2. Read `monthly_recurring_income`, `monthly_recurring_expense`, `monthly_mandate_expense`, `monthly_emi_total`, `monthly_od_interest`, `monthly_net` from the screen.
**Expected result:**
- monthly_recurring_income = 0.00 (no recurring income flagged)
- monthly_recurring_expense = 0.00
- monthly_mandate_expense = 649 + (29 × USD/INR rate) ≈ 649 + ~2400 = **~₹3,049** (exact rate-dependent; assert within ±₹5 of backend value)
- monthly_emi_total = 18,500.00
- monthly_od_interest = matches backend `_compute_od_monthly_interest` value
- monthly_net = 0 − 0 − 3049 − OD_interest = **negative, exact match**
**Bug severity if fails:** Critical — P0. Projection errors leak into Dashboard's next-month tile too.

### C40 — Projection EXCLUDES pending_review recurring-flagged transactions
**Priority:** P0
**Pre-conditions:** Insert T13 = expense ₹8,000, `is_recurring=true`, `status=pending_review`.
**Steps:** Open Cash Flow → projection.
**Expected result:** `monthly_recurring_expense` does NOT include T13. Backend query is `{status:"approved", is_recurring:true}` so pending is filtered server-side.
**Bug severity if fails:** Critical — P0.

### C41 — Projection EXCLUDES paused and cancelled mandates
**Priority:** P0
**Pre-conditions:** Seed A (M3 paused, M4 cancelled).
**Steps:** Projection screen.
**Expected result:** Neither M3 nor M4 contributes to `monthly_mandate_expense`. Only `status=active` mandates queried.
**Bug severity if fails:** Critical — P0.

### C42 — Projection with 0 approved transactions but active mandates exists
**Priority:** P1
**Pre-conditions:** User has 0 transactions, but 2 active mandates M1, M2 seeded.
**Steps:** Open Cash Flow.
**Expected result:** `monthly_recurring_income/expense = 0`, `monthly_mandate_expense > 0`, `monthly_net = -monthly_mandate_expense - od_interest` (negative). Projection still renders 24 months of bars driven by mandates alone. No empty-state shown.
**Bug severity if fails:** Major — P1.

### C43 — 24-month projection array length and labels
**Priority:** P1
**Pre-conditions:** Seed A, today = 2026-04-24.
**Steps:** Inspect `projection[]` array.
**Expected result:** Exactly 24 entries. `projection[0].label = "May 2026"`, `projection[1].label = "Jun 2026"`, …, `projection[23].label = "Apr 2028"`. `running_balance` cumulates `net` per month.
**Bug severity if fails:** Major — P1.

### C44 — May 2026 projection explicit (next month)
**Priority:** P0
**Pre-conditions:** Seed A.
**Steps:** Look at first projection bar (May 2026).
**Expected result:** `projected_income`, `projected_expense` (recurring only), `mandate_expense` (≈₹3,049), `od_interest`, `net`, `running_balance` all populated and math adds up: `net = projected_income - projected_expense - mandate_expense - od_interest` to the rupee.
**Bug severity if fails:** Critical — P0.

### C45 — 30 / 60 / 90 day drill-down (if rendered)
**Priority:** P2
**Pre-conditions:** Cash Flow screen shows period toggle.
**Steps:** If the view exposes 30/60/90 day segmented control, tap each and verify the bar chart reflects that horizon.
**Expected result:** 30 = month 1 only; 60 = months 1–2; 90 = months 1–3. Bars reflect correct mandate + recurring totals. (If no such control is currently shipped, mark N/A — view currently shows 24-month horizontal scroll.)
**Bug severity if fails:** Minor — P2.

### C46 — Income vs expense bars correctness
**Priority:** P0
**Pre-conditions:** Seed A + add approved recurring T14 income ₹100,000/month, T15 expense ₹20,000/month (both `is_recurring=true`, `recurring_frequency=monthly`).
**Steps:** Read chart.
**Expected result:** For each month: green income bar = 100,000; red expense bar = 20,000 + 3,049 (mandate merged per chart code: `abs(expense) + abs(mandates)`). Runs for 24 months.
**Bug severity if fails:** Critical — P0.

### C47 — EMI-specific bar / section
**Priority:** P1
**Pre-conditions:** Seed A (A4 home loan EMI ₹18,500).
**Steps:** Look for EMI section / tile on Cash Flow screen.
**Expected result:** EMI card shows ₹18,500/month, next debit day = 5th. Tapping drills into a list of EMI accounts.
**Bug severity if fails:** Major — P1.

### C48 — OD interest card with overdraft account
**Priority:** P1
**Pre-conditions:** Seed A (A5 overdraft ₹50,000 @ 12% p.a.).
**Steps:** Cash Flow → OD section.
**Expected result:** Monthly interest ≈ 50,000 × (12 / 100 / 365) × 30 = ₹493 (approximate, depends on daily-balance replay). Assert ±1 rupee of backend value.
**Bug severity if fails:** Major — P1.

### C49 — Net position line (running balance)
**Priority:** P1
**Pre-conditions:** Seed A with enough data that `running_balance` actually moves.
**Steps:** Inspect net-position line or `running_balance` per month.
**Expected result:** `running_balance[0] = current_balance + net[0]`, `running_balance[i] = running_balance[i-1] + net[i]`. Line is monotonic when net is consistently negative (e.g. debt situation).
**Bug severity if fails:** Major — P1.

### C50 — Chart bar tap → day's transactions (if drill implemented)
**Priority:** P2
**Pre-conditions:** Cash Flow chart rendered.
**Steps:** Tap a specific month's bar.
**Expected result:** Either sheet with that month's projected breakdown (income/expense/mandate rows) or navigation to transactions filtered to that month. No crash. If not implemented, document as backlog.
**Bug severity if fails:** Minor — P2.

### C51 — Chart horizontal scroll with 24 months
**Priority:** P1
**Pre-conditions:** Projection with 24 months.
**Steps:** Swipe chart horizontally.
**Expected result:** Chart is horizontally scrollable (see ScrollView in `CashFlowChartView`). Y-axis fixed on left (`AxisMarks(position: .leading)`). Frame width = `data.count × 56`.
**Bug severity if fails:** Minor — P2.

### C52 — Chart dark mode colors
**Priority:** P1
**Pre-conditions:** Dark mode.
**Steps:** Open Cash Flow.
**Expected result:** Green (`spentySuccess`) and red (`spentyError`) bars remain legible. Axis labels use `spentyTextSecondary` which is readable on dark. Grid lines visible but not dominant.
**Bug severity if fails:** Major — P1.

### C53 — Chart abbreviated Y-axis labels
**Priority:** P2
**Pre-conditions:** Projection with values > 1 lakh.
**Steps:** Inspect Y-axis.
**Expected result:** Large values shown as "1.2L", "3.4Cr" etc per `abbreviatedAmount`. Values < 1000 shown as raw number.
**Bug severity if fails:** Minor — P2.

### C54 — Chart accessibility: VoiceOver describes each bar
**Priority:** P2
**Pre-conditions:** VoiceOver on.
**Steps:** Swipe across chart.
**Expected result:** Each bar is accessible and reads month + type + amount (e.g. "May 2026 Income, ₹1,00,000"). If chart is not yet audio-accessible, file as known gap.
**Bug severity if fails:** Minor — P2. WCAG gap.

### C55 — Monthly calendar view opens from Dashboard/Cash Flow
**Priority:** P1
**Pre-conditions:** Seed A.
**Steps:** Tap "See calendar" / calendar button.
**Expected result:** `MonthlyCalendarView` sheet opens titled "May 2026". Grid starts on correct weekday (Mon=0 conversion). Days 1–31 shown.
**Bug severity if fails:** Major — P1.

### C56 — Monthly calendar heatmap and per-day dots
**Priority:** P1
**Pre-conditions:** Seed A (M1 debit_day=10, M2 debit_day=15, A4 EMI day=5).
**Steps:** Inspect calendar.
**Expected result:** Day 5 shows EMI dot (₹18,500). Day 10 shows Netflix mandate dot. Day 15 shows AWS mandate dot. Days with higher spend have more saturated background (heatmap). Day 22 (paused Medium mandate M3) has NO dot.
**Bug severity if fails:** Major — P1. Confirms paused mandates don't leak into calendar.

### C57 — Tap a calendar day → day detail
**Priority:** P1
**Pre-conditions:** Calendar open on May 2026.
**Steps:** Tap day 10.
**Expected result:** Detail pane/sheet shows Netflix ₹649 mandate entry. Close → return to calendar.
**Bug severity if fails:** Major — P1.

### C58 — Mandate with missing debit_day: not placed on calendar
**Priority:** P1
**Pre-conditions:** Add mandate M5 with no debit_day, no start_date.
**Steps:** Open calendar.
**Expected result:** M5 does NOT appear on any day (`dayOfMonth` returns nil). Mandate still contributes to monthly totals in the Mandates tab list but has no calendar dot.
**Bug severity if fails:** Minor — P2.

### C59 — Mandate foreign currency with estimated rate: badge appears
**Priority:** P2
**Pre-conditions:** M2 (USD 29) with `is_estimated_rate=true`.
**Steps:** Inspect calendar entry and mandate list row.
**Expected result:** Entry labeled with original currency (e.g. "USD 29.00 ≈ ₹2,390"). Estimated-rate badge shown. Tooltip/explanation accessible.
**Bug severity if fails:** Minor — P2.

### C60 — Calendar: month has 28/30/31 days handled correctly
**Priority:** P1
**Pre-conditions:** Change test date to 2027-01-31 so next month = Feb 2027 (28 days).
**Steps:** Open calendar.
**Expected result:** Only 28 day cells. A mandate with debit_day=30 is NOT plotted (out of range per the `day <= daysInNextMonth` guard). User sees neither a ghost cell nor a crash.
**Bug severity if fails:** Major — P1. Month-length bugs surface at February.

### C61 — Data freshness: create new recurring txn → appears in projection after refresh
**Priority:** P0
**Pre-conditions:** Seed A.
**Steps:**
1. From Transactions, add a new approved expense ₹5,000/month, tick "Recurring" (frequency=monthly).
2. Go to Cash Flow and pull-to-refresh.
**Expected result:** `monthly_recurring_expense` increases by ₹5,000. Projection bars for all 24 months shift. Calendar gains a new dot on the recurrence day.
**Bug severity if fails:** Critical — P0.

---

# Mandates test cases

### C62 — Mandate list shows every mandate including paused and cancelled
**Priority:** P1
**Pre-conditions:** Seed A has M1 active, M2 active, M3 paused, M4 cancelled.
**Steps:** Cash Flow → Mandates tab.
**Expected result:** All 4 rows in "All Mandates" section (per `/api/mandates` which doesn't filter by status), each with `StatusBadge` showing Active/Paused/Cancelled. Upcoming section shows ONLY next-30-days active mandates.
**Bug severity if fails:** Major — P1.

### C63 — Detect mandates button runs AI detection
**Priority:** P1
**Pre-conditions:** User has 12 months of approved txns with recurring Netflix pattern not yet flagged as a mandate.
**Steps:** Tap "Detect Mandates".
**Expected result:** Button shows "Detecting…" spinner (`isDetecting=true`). On completion, list reloads and newly detected Netflix mandate appears.
**Bug severity if fails:** Major — P1.

### C64 — Approve a detected mandate
**Priority:** P1
**Pre-conditions:** A newly detected mandate exists in "pending" or "detected" state (if the detection flow produces one).
**Steps:** Tap approve action.
**Expected result:** Mandate moves to Active state; it starts contributing to `monthly_mandate_expense` after next projection refresh.
**Bug severity if fails:** Major — P1.

### C65 — Pause an active mandate
**Priority:** P0
**Pre-conditions:** M1 active.
**Steps:** Swipe on M1 → Pause.
**Expected result:** Status changes to paused via `PATCH /api/mandates/{id}` with `status="paused"`. Projection refetches; `monthly_mandate_expense` drops by ₹649. Calendar removes dot on day 10.
**Bug severity if fails:** Critical — P0 (pending rule extended to "paused must not count").

### C66 — Resume a paused mandate
**Priority:** P1
**Pre-conditions:** M3 paused.
**Steps:** Swipe on M3 → Resume.
**Expected result:** Status = active. Projection refreshes; M3's ₹400 re-enters `monthly_mandate_expense`.
**Bug severity if fails:** Major — P1.

### C67 — Edit mandate amount inline
**Priority:** P1
**Pre-conditions:** M1 = ₹649.
**Steps:** Tap amount on M1 row → inline text field appears → type 799 → tap checkmark.
**Expected result:** `updateMandate(id, amount:799)` called. Row re-renders with ₹799. Projection totals update.
**Bug severity if fails:** Major — P1.

### C68 — Edit mandate frequency
**Priority:** P1
**Pre-conditions:** M1 frequency=monthly.
**Steps:** Open mandate edit sheet → change frequency to yearly → save.
**Expected result:** `monthly_equivalent` recalculated server-side (yearly → /12). If M1 amount ₹649 yearly, monthly_equivalent = 649/12 ≈ 54.08.
**Bug severity if fails:** Major — P1.

### C69 — Edit mandate debit_day
**Priority:** P1
**Pre-conditions:** M1 debit_day=10.
**Steps:** Edit → set debit_day=25 → save.
**Expected result:** Calendar moves M1 dot from day 10 to day 25. Upcoming recalculates next debit date accordingly.
**Bug severity if fails:** Major — P1.

### C70 — Edit mandate mandate_type (category)
**Priority:** P2
**Pre-conditions:** M1 type = "streaming".
**Steps:** Change to "other" → save.
**Expected result:** PATCH succeeds; type tag in row updates.
**Bug severity if fails:** Minor — P2.

### C71 — Delete mandate
**Priority:** P1
**Pre-conditions:** M1 exists.
**Steps:** Swipe → Delete → confirm.
**Expected result:** `DELETE /api/mandates/{id}` → 200. Row removed. Projection totals drop by ₹649. Calendar loses dot.
**Bug severity if fails:** Major — P1.

### C72 — Manually create mandate
**Priority:** P1
**Pre-conditions:** Empty mandates list.
**Steps:** Tap + → fill merchant "Gym", amount 1200, frequency monthly → Save.
**Expected result:** `POST /api/mandates` with source="manual". New row appears. Projection updates.
**Bug severity if fails:** Major — P1.

### C73 — Mandate edge: missing next_due_date
**Priority:** P2
**Pre-conditions:** Mandate M6 with no `debit_day` and no `start_date`.
**Steps:** Open Cash Flow Upcoming section and mandate detail.
**Expected result:** M6 does NOT appear in Upcoming (backend skips mandates without debit_day). Detail view displays "—" for next due date, no crash.
**Bug severity if fails:** Minor — P2.

### C74 — Mandate edge: vendor (merchant) deleted/renamed
**Priority:** P2
**Pre-conditions:** M1 merchant changes from "Netflix" to empty string via DB edit.
**Steps:** Open list.
**Expected result:** Row shows fallback "Unknown Merchant" (per `mandate.merchant ?? "Unknown Merchant"`). No crash.
**Bug severity if fails:** Minor — P2.

### C75 — Mandate edge: cancelled subscription (Netflix cancelled)
**Priority:** P1
**Pre-conditions:** M1 Netflix status changed to "cancelled" via SMS trigger or manual edit.
**Steps:** Cash Flow → projection, calendar, upcoming.
**Expected result:** M1 NOT in projection totals (only active queried), NOT on calendar, NOT in upcoming. Still listed in "All Mandates" with Cancelled badge.
**Bug severity if fails:** Critical — P0 (same class as paused).

### C76 — Mandate edge: two mandates detected from same email thread
**Priority:** P2
**Pre-conditions:** Email thread with "Netflix Standard" and "Netflix Premium" both auto-detected.
**Steps:** Detect mandates.
**Expected result:** Two separate rows, each with distinct `source_email_id`, both charged independently. Not deduplicated into one.
**Bug severity if fails:** Minor — P2.

### C77 — Empty mandates empty-state
**Priority:** P2
**Pre-conditions:** No mandates.
**Steps:** Open Mandates tab.
**Expected result:** Empty-state with icon, "no_mandates_found" copy, hint to tap Detect.
**Bug severity if fails:** Minor — P2.

### C78 — Recurring list: toggle on/off
**Priority:** P1
**Pre-conditions:** Approved txn T20 exists with `is_recurring=false`.
**Steps:** Mark T20 as recurring=true, frequency=monthly.
**Expected result:** `POST /api/transactions/{id}/toggle-recurring`. T20 appears in Recurring list. Projection rerun.
**Bug severity if fails:** Major — P1.

### C79 — Recurring list UI dark mode & localization
**Priority:** P2
**Pre-conditions:** Dark mode + Hindi.
**Steps:** Open Recurring list.
**Expected result:** Section header "Recurring Transactions" translated. Icons visible. Amounts formatted in Indian locale.
**Bug severity if fails:** Minor — P2.

---

# Reports test cases

### C80 — Reports default (This Month) load
**Priority:** P0
**Pre-conditions:** Seed A. Today 2026-04-24.
**Steps:** Open Reports tab.
**Expected result:** Period auto-set to 2026-04-01 → 2026-04-30. Summary shows totalIncome=₹1,28,000, totalExpense=₹30,799, net=₹97,201, transactionCount=5 (T1,T2,T3,T4,T5 — T6 pending excluded, T9 transfer not counted in totals but counted in count by backend).
**Bug severity if fails:** Critical — P0.

### C81 — Reports excludes pending_review (global rule)
**Priority:** P0
**Pre-conditions:** Seed A with T6 pending ₹50K expense.
**Steps:** Reports → This Month.
**Expected result:** totalExpense = ₹30,799 (NOT ₹80,799). Category breakdown does NOT include T6. CSV export rows do NOT include T6.
**Bug severity if fails:** Critical — P0. This is the headline rule.

### C82 — Period preset: Last 3 Months
**Priority:** P1
**Pre-conditions:** Seed A + 3 months of prior txns seeded.
**Steps:** Tap preset "Last 3 Months".
**Expected result:** startDate = 2026-01-24, endDate = 2026-04-24. Summary recomputes.
**Bug severity if fails:** Major — P1.

### C83 — Period preset: Last 6 Months
**Priority:** P2
**Pre-conditions:** 6 months of data seeded.
**Steps:** Tap "Last 6 Months".
**Expected result:** startDate = 2025-10-24, endDate = today. Summary/periods/categories all refresh.
**Bug severity if fails:** Minor — P2.

### C84 — Period preset: This Year
**Priority:** P1
**Pre-conditions:** Seed A.
**Steps:** Tap "This Year".
**Expected result:** startDate = 2026-01-01, endDate = 2026-12-31. Note this is calendar year not FY; document if product actually wants FY April-March for India.
**Bug severity if fails:** Major — P1. Product question too.

### C85 — Period preset: All Time
**Priority:** P2
**Pre-conditions:** Seed A.
**Steps:** Tap "All Time".
**Expected result:** startDate = 2000-01-01, endDate = today. Aggregates every approved txn ever.
**Bug severity if fails:** Minor — P2.

### C86 — Period preset: Custom range
**Priority:** P1
**Pre-conditions:** Seed A.
**Steps:** Tap Custom → set startDate=2026-03-01, endDate=2026-04-15 → Apply.
**Expected result:** Summary includes only approved txns in that window. T1 (Apr 1) included; T7 (Mar 31) included; T8 (2027) excluded.
**Bug severity if fails:** Major — P1.

### C87 — Reports by-period monthly bucketing
**Priority:** P0
**Pre-conditions:** Seed A + a February 2026 expense ₹7,000 approved.
**Steps:** Reports → This Year → inspect periods array.
**Expected result:** Each period = {month:"2026-02", income:0, expense:7000, net:-7000, count:1} and {month:"2026-04", income:128000, expense:30799, net:97201, count:5}. Sorted ascending by month string.
**Bug severity if fails:** Critical — P0.

### C88 — Reports by-category: expense donut
**Priority:** P0
**Pre-conditions:** Seed A with categories assigned (T2=Rent, T3=Groceries, T4=Fuel).
**Steps:** Reports → expense categories.
**Expected result:** Donut has 3 slices: Rent ₹25,000 (81.2%), Groceries ₹4,500 (14.6%), Fuel ₹1,299 (4.2%). Percentages computed from `totalCategoryAmount`. Slices sorted by amount desc.
**Bug severity if fails:** Critical — P0.

### C89 — Reports by-category: income type toggle
**Priority:** P1
**Pre-conditions:** Seed A + categories on T1 (Salary), T5 (Freelance).
**Steps:** Toggle category type to Income.
**Expected result:** Donut shows Salary ₹120,000 (93.75%), Freelance ₹8,000 (6.25%). Backend query uses `transaction_type=income`.
**Bug severity if fails:** Major — P1.

### C90 — Category drill-down → filtered transaction list
**Priority:** P1
**Pre-conditions:** Groceries slice has 1 txn (T3).
**Steps:** Tap Groceries slice.
**Expected result:** Navigates to Transactions list pre-filtered to category=Groceries within the current report period. Only T3 shown.
**Bug severity if fails:** Major — P1.

### C91 — Subcategory breakdown
**Priority:** P2
**Pre-conditions:** Rent category has a subcategory "House Rent".
**Steps:** Expand Rent slice / row.
**Expected result:** Subcategory row shows total ₹25,000, count 1. Matches `ReportSubcategory` model.
**Bug severity if fails:** Minor — P2.

### C92 — Income vs expense split chart
**Priority:** P1
**Pre-conditions:** Seed A.
**Steps:** Reports → Income vs Expense view/tile.
**Expected result:** `/api/reports/income-expense` returns totalIncome 128000, totalExpense 30799, net 97201, incomeByCategory and expenseByCategory arrays populated.
**Bug severity if fails:** Major — P1.

### C93 — Zero-data period
**Priority:** P1
**Pre-conditions:** Custom range 2023-01-01 → 2023-01-31 (no data).
**Steps:** Apply.
**Expected result:** Summary shows 0 for all totals, transactionCount=0. Donut shows empty-state ("No categories"). No division-by-zero crash in percentage computation.
**Bug severity if fails:** Major — P1.

### C94 — Single-transaction period
**Priority:** P2
**Pre-conditions:** Custom range containing exactly T3 (₹4,500 groceries).
**Steps:** Apply.
**Expected result:** totalExpense=4500, totalIncome=0, net=-4500. Donut has single 100% slice.
**Bug severity if fails:** Minor — P2.

### C95 — Performance: reports over 1000+ transactions
**Priority:** P1
**Pre-conditions:** Seed 1,500 approved txns across 12 months.
**Steps:** Reports → All Time → measure time to interactive.
**Expected result:** Summary + periods + categories populate within 3s. No UI jank. Backend caps at 5000 rows which covers this.
**Bug severity if fails:** Major — P1.

### C96 — Export CSV
**Priority:** P1
**Pre-conditions:** Seed A, Reports period = This Month.
**Steps:** Tap Export → CSV.
**Expected result:** File `SpentyAI_Report.csv` saved to temp dir, share sheet opens. CSV contains only approved April txns (no pending T6). Headers: date,description,amount,type,category (or equivalent per backend).
**Bug severity if fails:** Major — P1.

### C97 — Export PDF
**Priority:** P1
**Pre-conditions:** Same as C96.
**Steps:** Tap Export → PDF.
**Expected result:** `SpentyAI_Report.pdf` generated. Contains summary totals, category breakdown, period chart. No pending rows. Currency formatted with user base symbol.
**Bug severity if fails:** Major — P1.

### C98 — Export cancellation
**Priority:** P2
**Pre-conditions:** Export in-flight.
**Steps:** Tap Cancel on share sheet before file completes.
**Expected result:** No crash. `isExporting` resets to false. Temp file cleaned up or overwritten on retry.
**Bug severity if fails:** Minor — P2.

### C99 — Tax summary: India FY April → March generation
**Priority:** P1
**Pre-conditions:** Past Insights → create summary dateFrom=2025-04-01, dateTo=2026-03-31.
**Steps:** Generate.
**Expected result:** Backend aggregates 12 months Apr 2025 → Mar 2026. totals matches sum of approved txns in that window. Period correctly honors Indian FY.
**Bug severity if fails:** Major — P1.

### C100 — Tax summary: 80C-eligible category filter (if surfaced)
**Priority:** P2
**Pre-conditions:** Tax summary detail open.
**Steps:** Look for section-80C eligible filter (e.g. insurance, ELSS, PPF txns).
**Expected result:** If rendered, only txns whose category is in 80C list shown, with running total vs ₹1,50,000 cap. If not rendered, log as backlog.
**Bug severity if fails:** Minor — P2 (feature-gate).

### C101 — Tax summary: HRA computation (if surfaced)
**Priority:** P2
**Pre-conditions:** User has rent-paid txns and salary HRA component configured.
**Steps:** Open tax summary.
**Expected result:** HRA exempt amount shown per India income tax rules (min of three formulas). If not in current build, backlog.
**Bug severity if fails:** Minor — P2.

### C102 — Reports dark mode + localization
**Priority:** P1
**Pre-conditions:** Dark mode + Hindi.
**Steps:** Navigate all Reports tabs.
**Expected result:** Labels "Summary", "By Period", "By Category" translated. Donut slices keep distinct colors with enough contrast on dark background. Custom date picker in Hindi locale.
**Bug severity if fails:** Major — P1.

### C103 — Reports accessibility: VoiceOver on donut
**Priority:** P2
**Pre-conditions:** VoiceOver on, donut with 3 slices.
**Steps:** Swipe focus to donut.
**Expected result:** Each slice announced separately: "Rent, 81%, ₹25,000", "Groceries, 14%, ₹4,500", "Fuel, 4%, ₹1,299". Chart has overall label. If not implemented, file a11y gap.
**Bug severity if fails:** Minor — P2.

### C104 — Reports refresh after approving a pending txn
**Priority:** P0
**Pre-conditions:** Seed A. Reports open on This Month; totalExpense=30799.
**Steps:** Go to Pending list → approve T6 (₹50K expense) → return to Reports → pull-to-refresh (or re-apply preset).
**Expected result:** totalExpense becomes ₹80,799. Category breakdown gains T6's category row. CSV export now includes T6.
**Bug severity if fails:** Critical — P0.

### C105 — Reports edge: txn on the very last day of the range
**Priority:** P0
**Pre-conditions:** Custom range endDate=2026-04-30 inclusive. T11 is approved expense on 2026-04-30.
**Steps:** Apply.
**Expected result:** T11 INCLUDED (backend uses `$lte` inclusive). T12 on 2026-05-01 NOT included.
**Bug severity if fails:** Critical — P0.

### C106 — Reports edge: uncategorized transactions bucket
**Priority:** P1
**Pre-conditions:** T4 has no `category_id`.
**Steps:** Reports → by-category.
**Expected result:** "Uncategorized" row shows ₹1,299 from T4. Still excluded if pending.
**Bug severity if fails:** Major — P1.

### C107 — Reports: data freshness
**Priority:** P0
**Pre-conditions:** Reports open.
**Steps:** Add new approved expense T15 ₹2,000 today from Transactions tab → return to Reports → pull-to-refresh.
**Expected result:** totalExpense += 2000, category updated, period row's count +1. Refresh does not duplicate rows.
**Bug severity if fails:** Critical — P0.

### C108 — Reports: switch back from custom to This Month resets dates
**Priority:** P2
**Pre-conditions:** User had set custom 2023-01-01 → 2023-01-31.
**Steps:** Tap preset "This Month".
**Expected result:** startDate resets to 2026-04-01, endDate 2026-04-30. Data reloads.
**Bug severity if fails:** Minor — P2.

### C109 — Reports: two rapid preset taps don't race
**Priority:** P1
**Pre-conditions:** Slow network.
**Steps:** Tap "Last 3 Months", immediately tap "This Year".
**Expected result:** Final state matches "This Year". No torn state where summary is from one range and categories from another. Per code, `loadData()` captures dates before async-let, but multiple overlapping calls could still race — verify.
**Bug severity if fails:** Major — P1.

### C110 — Reports: error banner on 500
**Priority:** P1
**Pre-conditions:** Force backend 500 on `/api/reports/summary`.
**Steps:** Reload.
**Expected result:** `showError=true` → banner appears with error message. Periods and Categories may still populate from their independent calls. No crash.
**Bug severity if fails:** Major — P1.

---

# Cross-cutting / meta test cases

### C111 — End-to-end consistency: Dashboard, Cash Flow, Reports show same April numbers
**Priority:** P0
**Pre-conditions:** Seed A.
**Steps:** Compare Expense MTD on Dashboard vs Reports This Month totalExpense.
**Expected result:** Both equal ₹30,799 to the rupee. Backend should be the single source of truth.
**Bug severity if fails:** Critical — P0 (internal inconsistency is worse than a single wrong number).

### C112 — Pending rule holds across screens simultaneously
**Priority:** P0
**Pre-conditions:** Seed A with pending T6 ₹50K expense.
**Steps:** On Dashboard: Expense ₹30,799. On Cash Flow projection: `monthly_recurring_expense` unchanged. On Reports This Month: totalExpense ₹30,799. In CSV export: T6 absent.
**Expected result:** All four scopes agree. Pending transaction ONLY visible in Pending Approval card and pending list.
**Bug severity if fails:** Critical — P0. Headline rule.

### C113 — Paused mandate rule holds across screens
**Priority:** P0
**Pre-conditions:** M3 paused.
**Steps:** Cash Flow summary totals, calendar, projection bars, upcoming, Dashboard next-month tile.
**Expected result:** None of them include M3. Mandate still visible in "All Mandates" list with Paused badge.
**Bug severity if fails:** Critical — P0.

### C114 — Sign out and back in: no stale cache leak
**Priority:** P1
**Pre-conditions:** User A signed in, data loaded. Sign out.
**Steps:** Sign in as user B with different seed.
**Expected result:** Dashboard shows user B's totals. No residual user A amounts. ViewModel state reset.
**Bug severity if fails:** Critical — P0 if cross-user data leaks.

### C115 — Offline mode / network-down
**Priority:** P1
**Pre-conditions:** Airplane mode on. Dashboard previously loaded (cached).
**Steps:** Pull-to-refresh.
**Expected result:** Error banner "Network unavailable". Previous data still visible. No crash. Restoring network → refresh → succeeds.
**Bug severity if fails:** Major — P1.

### C116 — Very large rupee values
**Priority:** P2
**Pre-conditions:** User with Net Worth ₹99,99,99,99,999 (9,999 crore).
**Steps:** Dashboard.
**Expected result:** Number renders without overflow/truncation/crash. Abbreviated as "9999.00Cr" if abbreviation enabled.
**Bug severity if fails:** Minor — P2.

### C117 — Negative-only portfolio (all liabilities, no assets)
**Priority:** P1
**Pre-conditions:** Only credit card and loan accounts.
**Steps:** Dashboard.
**Expected result:** Net Worth negative, red tint. No division-by-zero or NaN. Projection still works if mandates/EMI exist.
**Bug severity if fails:** Major — P1.

### C118 — Time zone: user in UTC+14 near month boundary
**Priority:** P1
**Pre-conditions:** Device time zone = Pacific/Kiribati (+14). Today local = 2026-04-30 at 23:59, UTC = 2026-04-30 09:59.
**Steps:** Insert txn at "local today" which is UTC 2026-04-30. Check Dashboard MTD.
**Expected result:** Txn counted in April MTD. Backend stores dates as strings (`YYYY-MM-DD`) so client must send correct local-date string. Verify no off-by-one.
**Bug severity if fails:** Major — P1.

### C119 — Concurrent mutation: pause mandate while projection refetching
**Priority:** P2
**Pre-conditions:** Cash Flow loading projection (slow network).
**Steps:** Mid-load, tap Pause on a mandate.
**Expected result:** Pause action completes (PATCH). After projection returns, viewModel triggers another refresh so final state reflects paused mandate. No stuck state showing both active bar amount AND paused badge.
**Bug severity if fails:** Minor — P2.

### C120 — Server returns null numeric fields
**Priority:** P1
**Pre-conditions:** Mock `/api/dashboard/summary` to return nulls for totals.
**Steps:** Load Dashboard.
**Expected result:** Optional-coalescing to 0 in ViewModel (`summary?.netWorth ?? 0`). Cards show ₹0. No crash, no "nil" rendered.
**Bug severity if fails:** Major — P1.

---

# Coverage summary

- **Dashboard cases:** C01–C30 (30)
- **Past Insights / Tax Summary cases:** C31–C37 (7)
- **Cash Flow (projection, chart, calendar, recurring, mandates-integration) cases:** C38–C61 (24)
- **Mandates (CRUD, detection, edge cases) cases:** C62–C79 (18)
- **Reports (summary, period, category, export, tax) cases:** C80–C110 (31)
- **Cross-cutting consistency / edge / offline cases:** C111–C120 (10)

**Total test cases: 120.**

Priority distribution:
- **P0 (Critical):** ~30 — all math correctness, pending/paused rules, data freshness, cross-screen consistency
- **P1 (Major):** ~55 — refresh paths, CRUD, dark mode, localization, performance on 1K+ rows, edge cases on date boundaries
- **P2 (Minor):** ~33 — nice-to-have UX polish, abbreviations, a11y gaps, rare-edge-case inputs
- **P3:** 0 — this domain has no non-blocking items at P3 level; anything that fails here affects user trust in numbers

Headline coverage:
1. **The pending-rule (CRITICAL user feedback)** is verified in every calculation-bearing test and again holistically in C05, C07, C08, C40, C75, C81, C104, C112.
2. **Paused / cancelled mandate exclusion** is verified in C28, C41, C65, C75, C113.
3. **Math-to-the-rupee** cases with explicit numeric expectations: C02, C03, C04, C05, C06, C22, C39, C44, C46, C48, C49, C80, C87, C88, C89, C105.
4. **Date / month-boundary** edges: C04, C23, C24, C60, C86, C105, C118.
5. **Cross-screen consistency:** C111 asserts Dashboard == Reports for the same period.
6. **Localization (EN↔HI), dark mode, a11y, performance:** C15–C22, C52, C54, C79, C95, C102, C103.
7. **Data freshness** (create txn → appears on refresh): C13, C14, C61, C107.
