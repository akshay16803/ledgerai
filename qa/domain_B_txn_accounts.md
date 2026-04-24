# Domain B — Transactions, Accounts, Categories & Reconciliation — iOS Test Plan

**Target platform:** iOS (SpentyAI Swift app)
**Scope:** Everything under `Features/Transactions`, `Features/Accounts`, `Features/Categories`, `Features/Reconciliation` plus the backend FastAPI routes that back them.
**Test device matrix:** iPhone 17 Pro (primary), iPhone SE 3rd gen (smallest), iPad Pro 13" (large). iOS 18 minimum.
**Build:** `emergent` branch, development backend `api.spentyai.com`.
**Seed data:** Use `create_test_data.py` for a clean baseline; `test_hdfc_statement.csv` for reconciliation.

---

## Legend

- **Priority:** P0 = blocker (must pass before ship). P1 = core flow. P2 = edge case. P3 = polish / accessibility.
- **Bug severity if fails:** S1 Critical / S2 High / S3 Medium / S4 Low.
- "Approved-only rule" and "AI-recurring rule" are explicit hard requirements from the user; they appear as their own test cases and as assertions embedded in many others.

---

## Section 1 — Transactions CRUD (Create)

### B01 — Create expense transaction with all required fields
**Priority:** P0
**Pre-conditions:** Logged in, at least one asset account exists, at least one expense category exists.
**Steps:**
1. Tap Transactions tab.
2. Tap the `+` toolbar button.
3. Select type = Expense.
4. Enter amount `500.00`, date = today, account = "HDFC Savings", category = "Food & Dining", description = "Lunch".
5. Tap Save.
**Expected result:** Sheet dismisses. New row appears at top of list. Account balance drops by 500. Row shows the red up-arrow icon, amount in error color, correct category and account names.
**Bug severity if fails:** S1

### B02 — Create income transaction
**Priority:** P0
**Pre-conditions:** Asset account + income category present.
**Steps:** Create a transaction, type = Income, amount = 50000, category = Salary, account = HDFC Savings, save.
**Expected result:** Row rendered green down-arrow. Account balance increases by 50000. `/api/transactions` returns type=income.
**Bug severity if fails:** S1

### B03 — Create transfer between two accounts
**Priority:** P0
**Pre-conditions:** At least two accounts exist (e.g., HDFC Savings + Cash).
**Steps:** Create transaction with type = Transfer, source account = HDFC Savings, destination account = Cash, amount = 2000.
**Expected result:** HDFC balance -2000; Cash balance +2000. Row icon = arrow.left.arrow.right.circle.fill. Transaction stored once with both `account_id` and `to_account_id`.
**Bug severity if fails:** S1

### B04 — Transfer into overdraft account decreases outstanding
**Priority:** P1
**Pre-conditions:** An overdraft (`sub_type = overdraft`) account and a normal bank account exist. OD has outstanding = 10,000.
**Steps:** Create Transfer from HDFC Savings -> OD, amount = 3,000.
**Expected result:** HDFC Savings balance -3,000; OD outstanding drops from 10,000 to 7,000 (OD special-case logic in `apply_transaction_to_balances`).
**Bug severity if fails:** S2

### B05 — Transfer OUT of overdraft increases outstanding
**Priority:** P1
**Pre-conditions:** OD account + destination asset account.
**Steps:** Transfer from OD -> Savings, amount 5,000.
**Expected result:** OD outstanding INCREASES by 5,000; Savings +5,000.
**Bug severity if fails:** S2

### B06 — Create transaction dated today
**Priority:** P0
**Pre-conditions:** Any account.
**Steps:** Open new transaction form; verify date picker defaults to today; save without changing.
**Expected result:** Transaction saved with today's yyyy-MM-dd. No warnings.
**Bug severity if fails:** S2

### B07 — Create transaction dated in the past
**Priority:** P1
**Pre-conditions:** Account with `balance_as_of_date` < test date.
**Steps:** Pick a past date (30 days ago). Save amount 200 as expense.
**Expected result:** Created with past date; balance recalculates to include it. If date is before account's `balance_as_of_date`, it is NOT applied to balance (verify via account detail → pull to refresh → balance unchanged).
**Bug severity if fails:** S2

### B08 — Create transaction dated >30 days in the future shows warning
**Priority:** P2
**Pre-conditions:** Any account.
**Steps:** Set date to +60 days; save.
**Expected result:** Transaction still created (backend `B8` warning comment), response contains `warning` field. iOS should surface the warning (info banner) or at minimum not crash.
**Bug severity if fails:** S3

### B09 — Create with amount = 0 is rejected
**Priority:** P0
**Pre-conditions:** Any account.
**Steps:** Enter amount 0, fill other fields, tap Save.
**Expected result:** Backend returns 400 "Amount must be positive"; iOS shows error alert/banner. No row added.
**Bug severity if fails:** S1

### B10 — Create with negative amount is rejected
**Priority:** P0
**Steps:** Type `-100` in amount (numeric keypad on iOS may not allow this; verify).
**Expected result:** Either UI prevents `-` entry (decimal pad) OR save is blocked with validation error. Backend also rejects. No transaction persisted.
**Bug severity if fails:** S1

### B11 — Create with 10-digit huge amount (1e9)
**Priority:** P2
**Steps:** Enter `1000000000` (100 crore). Save.
**Expected result:** Accepted. Amount renders as `1,00,00,00,000` (Indian grouping) in CurrencyText, no truncation. Balance math correct.
**Bug severity if fails:** S3

### B12 — Decimal precision (paise)
**Priority:** P1
**Steps:** Enter `123.45`; save. Enter `0.01`; save. Enter `999999.99`; save.
**Expected result:** Two-decimal values round-trip exactly. Balance after three saves equals 1,123,468.45 (if starting at 0). No floating-point drift visible.
**Bug severity if fails:** S2

### B13 — Description / notes accept emoji and special chars
**Priority:** P2
**Steps:** Set description to "Coffee with Rahul at CCD! @Indiranagar". Save another with emoji "Lunch 🍕🍔". Save another with Hindi "दोपहर का भोजन".
**Expected result:** All three save, render correctly in list + detail, round-trip via `/api/transactions/{id}`.
**Bug severity if fails:** S3

### B14 — Create expense without category is rejected
**Priority:** P0
**Pre-conditions:** Account exists.
**Steps:** Leave category blank on expense.
**Expected result:** Backend returns 400 "Category is required for income/expense". iOS either disables Save button (preferable) or shows error banner.
**Bug severity if fails:** S1

### B15 — Create transfer without destination account is rejected
**Priority:** P0
**Steps:** Pick Transfer type, leave `to_account_id` blank.
**Expected result:** 400 "Destination account required for transfer". Form should show inline validation.
**Bug severity if fails:** S1

### B16 — Create with non-existent account is rejected
**Priority:** P2
**Steps:** Using a debug build or stale list, attempt to submit with an `account_id` that was just deleted.
**Expected result:** 404 "Account not found". No transaction persisted.
**Bug severity if fails:** S3

### B17 — Attach photo receipt via PhotosPicker
**Priority:** P1
**Pre-conditions:** Photos permission granted.
**Steps:** In the transaction form, tap "Attach Receipt" → choose photo → save.
**Expected result:** `uploadedReceiptId` set, receipt linked to transaction in `db.receipts`. Detail view shows attachment thumbnail.
**Bug severity if fails:** S2

### B18 — Capture receipt via camera (`CameraCaptureView`)
**Priority:** P1
**Pre-conditions:** Camera permission granted on device.
**Steps:** Tap camera icon → capture photo → save transaction.
**Expected result:** Image uploaded, receipt linked, transaction saved. If camera permission denied, alert surfaces instead of crashing.
**Bug severity if fails:** S2

### B19 — Mark transaction as recurring during manual create
**Priority:** P1
**Steps:** Toggle `is_recurring` on, pick frequency = monthly, recurrence date = 5.
**Expected result:** Payload includes `is_recurring=true`, `recurring_frequency="monthly"`, `recurrence_date="5"`. Backend persists. Cash Flow projections pick it up.
**Bug severity if fails:** S2

### B20 — Sub-category picker is gated by parent category
**Priority:** P1
**Steps:** Pick category Food & Dining → subcategory picker shows only its children (Groceries, Restaurants, Coffee & Tea). Change parent to Transportation; subcategory resets.
**Expected result:** Subcategory list reflects `subcategories(for:)` from the ViewModel. Old selection cleared on parent change (after `hasPopulated` is true).
**Bug severity if fails:** S2

### B21 — Quick-create new account from transaction form
**Priority:** P2
**Steps:** In the account picker, tap "+ New Account" → enter name → save. Return to form; new account selected.
**Expected result:** Account list refreshed; new account selected in form; can save transaction with it.
**Bug severity if fails:** S3

### B22 — Quick-create new category from transaction form
**Priority:** P2
**Steps:** Similar to B21 for category and subcategory.
**Expected result:** New (sub)category usable immediately after creation.
**Bug severity if fails:** S3

### B23 — Link transaction to an invoice payment
**Priority:** P2
**Pre-conditions:** An invoice exists.
**Steps:** From invoice detail → Record Payment → amount & account; saves a new transaction linked to the invoice.
**Expected result:** Transaction created; invoice's `amount_paid` increases; invoice status updated to Partial / Paid. Deleting this txn (see B37) reverses.
**Bug severity if fails:** S2

### B24 — Link transaction to a bill (purchases)
**Priority:** P2
**Pre-conditions:** A bill exists.
**Steps:** From bill detail → Pay Bill → creates an expense transaction.
**Expected result:** Transaction created and associated. Bill marked paid/partial.
**Bug severity if fails:** S2

---

## Section 2 — Transactions Edit / Delete

### B25 — Edit description only
**Priority:** P0
**Steps:** Swipe-edit existing approved txn → change description → save.
**Expected result:** Description updated; amount/account/balance unchanged. `reverse → apply` no-op net effect.
**Bug severity if fails:** S2

### B26 — Edit amount on approved transaction
**Priority:** P0
**Pre-conditions:** Approved expense of 500.
**Steps:** Change amount to 800; save.
**Expected result:** `reverse_transaction_balances` adds back 500, then `apply_transaction_to_balances` subtracts 800. Net account delta = -300.
**Bug severity if fails:** S1

### B27 — Edit account (move txn from A to B)
**Priority:** P0
**Pre-conditions:** Approved expense on Account A of 1,000.
**Steps:** Change account to B.
**Expected result:** Account A balance +1,000 (reverted). Account B balance -1,000. Both accounts visible on refresh reflect new balance.
**Bug severity if fails:** S1

### B28 — Edit transaction type (expense → income)
**Priority:** P1
**Steps:** Approved expense of 500 on Account A. Change type to income.
**Expected result:** Account A balance shifts by +1,000 net (reverse -(-500) = +500, apply +500). Icon color flips green. Category field should be revalidated (expense category may be invalid for income).
**Bug severity if fails:** S2

### B29 — Edit date
**Priority:** P1
**Steps:** Change date back 1 year.
**Expected result:** Balance logic re-applied based on `balance_as_of_date` rule — if new date is before as-of-date, txn is excluded from balance. Verify.
**Bug severity if fails:** S2

### B30 — Edit category
**Priority:** P1
**Steps:** Change a transaction's category. Save.
**Expected result:** Category updated; reports rebucket on next load. No balance change.
**Bug severity if fails:** S3

### B31 — Edit recurring fields
**Priority:** P1
**Steps:** Toggle `is_recurring=false → true`, pick frequency, save.
**Expected result:** Persisted via `/toggle-recurring` endpoint. UI in CashFlow tab shows it. Per user rule, the AI must NEVER auto-flip this; manual toggle is fine.
**Bug severity if fails:** S2

### B32 — Single delete with confirmation dialog
**Priority:** P0
**Steps:** Swipe left on a txn → Delete → confirm.
**Expected result:** Confirmation dialog appears with "cannot_undo" message. On confirm, txn removed from list, balance reverts (if approved). On cancel, nothing happens.
**Bug severity if fails:** S1

### B33 — Delete approved expense reverts account balance
**Priority:** P0
**Steps:** Account A balance = 10,000. Delete an approved expense of 2,000.
**Expected result:** Balance becomes 12,000 immediately (pull to refresh confirms).
**Bug severity if fails:** S1

### B34 — Delete approved transfer reverts both accounts
**Priority:** P0
**Steps:** Delete a transfer A→B of 1,000.
**Expected result:** Account A +1,000; Account B -1,000. Both reflect instantly.
**Bug severity if fails:** S1

### B35 — Delete pending_review transaction does NOT change balance
**Priority:** P0 (Approved-only rule)
**Pre-conditions:** Txn with `status = pending_review`.
**Steps:** Delete the pending txn from pending list.
**Expected result:** Txn gone from pending list. Account balance unchanged (pending never contributed per user rule). Dashboard Net Worth / Income / Expenses unchanged.
**Bug severity if fails:** S1

### B36 — Bulk delete via long-press select
**Priority:** P1
**Steps:** Long-press a row → enters selection mode → tap 5 more rows → tap bulk Delete.
**Expected result:** All 6 delete via `/transactions/bulk-delete`. Balances reverse for approved ones. Selection mode exits.
**Bug severity if fails:** S2

### B37 — Delete transaction linked to invoice payment
**Priority:** P1
**Pre-conditions:** A txn tagged as invoice payment.
**Steps:** Delete the transaction.
**Expected result:** Invoice's `amount_paid` decreases; status recalculates to Partial/Unpaid. If backend doesn't auto-reverse, a warning dialog should appear ("This payment is linked to invoice X — continue?").
**Bug severity if fails:** S2

### B38 — Delete transaction linked to a mandate
**Priority:** P2
**Pre-conditions:** A mandate (scheduled recurring) has this txn as its latest debit.
**Steps:** Delete.
**Expected result:** Mandate remains; the recorded debit for that period is gone. Mandate schedule shows "missed" for that period if auto-generated.
**Bug severity if fails:** S3

### B39 — Undo after delete (if supported)
**Priority:** P3
**Steps:** Delete a transaction; look for an undo toast.
**Expected result:** If implemented, "Undo" in toast restores txn with same id and balance. If NOT implemented, no phantom undo button should appear.
**Bug severity if fails:** S4

### B40 — Delete a loan_emi recurring template (source = loan_emi)
**Priority:** P2
**Pre-conditions:** Loan account was created with EMI; an auto-generated recurring txn exists with `source = loan_emi`.
**Steps:** Delete it from list.
**Expected result:** Template removed. Cash Flow projection stops showing future EMI. No balance change (loan_emi templates don't apply to balances per `apply_transaction_to_balances`).
**Bug severity if fails:** S3

### B41 — Concurrent edit: web & iOS
**Priority:** P2
**Steps:** Open same txn in web and iOS simultaneously. On iOS change amount to 100. On web change amount to 200. Save iOS first, then web.
**Expected result:** Last-write-wins (backend has no optimistic lock). iOS silently gets outdated state on next refresh. No crashes.
**Bug severity if fails:** S3

### B42 — Offline create queues or errors explicitly
**Priority:** P1
**Steps:** Turn on airplane mode. Try creating a txn.
**Expected result:** Either (a) save fails with clear network-error message, form stays open, OR (b) queued locally with "sync pending" indicator. Never silent loss. When connectivity returns, queued items (if any) flush.
**Bug severity if fails:** S2

---

## Section 3 — Pending Review (AI-ingested transactions)

### B43 — Pending list is segregated from approved list
**Priority:** P0 (Approved-only rule)
**Pre-conditions:** At least 5 pending_review txns from email sync.
**Steps:** Open Transactions tab (default list). Open Pending Review screen.
**Expected result:** Main list shows ONLY approved (`status=approved` filter in `TransactionsViewModel.fetchTransactionsPage`). Pending list shows ONLY `status=pending_review`.
**Bug severity if fails:** S1

### B44 — Dashboard excludes pending transactions
**Priority:** P0 (Approved-only rule)
**Pre-conditions:** Several pending txns totaling 25,000 exist.
**Steps:** Open Dashboard.
**Expected result:** Net Worth, Income, Expenses, Cash Flow, Reports all ignore pending txns. A banner/chip may show "N pending to review" but the numeric totals do not include them.
**Bug severity if fails:** S1

### B45 — Approve one pending transaction
**Priority:** P0
**Steps:** Open Pending → tap Approve on one item.
**Expected result:** `/transactions/{id}/approve` returns updated txn with `status=approved`. Item disappears from pending, appears in approved list. Account balance updates immediately. Source email auto-archives if `source=email`.
**Bug severity if fails:** S1

### B46 — Edit during review: change amount
**Priority:** P1
**Steps:** Open pending txn → edit amount from 1,234 to 1,200 → save → approve.
**Expected result:** Amount persisted; on approval balance changes by -1,200 (not 1,234). No double-apply.
**Bug severity if fails:** S2

### B47 — Edit during review: change account
**Priority:** P1
**Steps:** Pending email txn defaulted to HDFC. Change to Amex CC. Approve.
**Expected result:** Sender→account mapping saved for future emails (confidence_count++). Balance hits Amex, not HDFC.
**Bug severity if fails:** S2

### B48 — Edit during review: change category (AI guess override)
**Priority:** P1
**Steps:** AI guessed "Food & Dining" but actual is "Transportation". Change category. Approve.
**Expected result:** Category saved. No error. Per user rule, AI guessing categories IS allowed — user override should not cause warnings.
**Bug severity if fails:** S3

### B49 — AI did not assume is_recurring when not evidenced
**Priority:** P0 (AI-recurring rule)
**Pre-conditions:** A Swiggy receipt email (single meal, no subscription language) in pending.
**Steps:** Open pending detail.
**Expected result:** `is_recurring=false`. Per backend prompt in `_build_email_analysis_prompt`, Swiggy single meals must be non-recurring.
**Bug severity if fails:** S1

### B50 — AI set is_recurring=true ONLY on subscription language
**Priority:** P0 (AI-recurring rule)
**Pre-conditions:** A Netflix/Spotify auto-renew email in pending.
**Steps:** Open pending detail.
**Expected result:** `is_recurring=true` with frequency=monthly and recurrence_date populated. Evidence: explicit "auto-renew" / "monthly plan" / "NACH" etc.
**Bug severity if fails:** S1

### B51 — AI category guess is allowed
**Priority:** P1 (User rule)
**Pre-conditions:** Pending txn where AI filled `category_id`.
**Steps:** Verify category is populated on open.
**Expected result:** A guessed category is acceptable (user rule). User may override but no UI warning.
**Bug severity if fails:** S3

### B52 — Bulk approve all pending
**Priority:** P1
**Steps:** In selection mode, Select All → Bulk Approve.
**Expected result:** `/transactions/bulk-approve` runs; all balances applied. List empties of pending items. Any txn that had errors (e.g. deleted account) is skipped with error count shown.
**Bug severity if fails:** S2

### B53 — Reject one pending transaction
**Priority:** P0
**Steps:** Pending txn → Reject.
**Expected result:** `status=rejected`. Item disappears from pending. If previously approved (shouldn't be, but just in case), balance reverses. Archived email record is deleted.
**Bug severity if fails:** S1

### B54 — Reject all pending
**Priority:** P1
**Steps:** Select all → Bulk Reject.
**Expected result:** All flipped to rejected. None counts toward dashboard. Confirm with `/api/transactions?status=rejected` returns the list.
**Bug severity if fails:** S2

### B55 — Approved transaction shows up in Dashboard/CashFlow/Reports
**Priority:** P0 (Approved-only rule)
**Steps:** Approve a pending expense of 777. Immediately open Dashboard.
**Expected result:** Expenses total increases by 777. CashFlow monthly expense line moves. Reports by-category has the new entry under its category.
**Bug severity if fails:** S1

### B56 — Approved then rejected correctly reverses balance
**Priority:** P1
**Steps:** Approve a pending expense (balance drops). Then open it and Reject.
**Expected result:** `reject_transaction` sees old status was approved, calls `reverse_transaction_balances`, balance restored. Status = rejected; excluded from dashboard.
**Bug severity if fails:** S2

---

## Section 4 — Transaction List, Search, Filter, Sort, Pagination

### B57 — Filter by transaction type
**Priority:** P0
**Steps:** Tap filter pill "Income" → list refreshes.
**Expected result:** Only income txns. `transaction_type=income` query param sent. Same for Expense and Transfer.
**Bug severity if fails:** S2

### B58 — Filter by account
**Priority:** P0
**Steps:** Tap account menu → pick HDFC Savings.
**Expected result:** Only txns where `account_id=<hdfc>` OR `to_account_id=<hdfc>` (transfers in/out both included per backend `$or`).
**Bug severity if fails:** S2

### B59 — Filter by date range
**Priority:** P0
**Steps:** Open date popover → pick from 2026-01-01 to 2026-01-31 → Apply.
**Expected result:** Only Jan txns shown. Clear-chip visible; tapping it removes filter.
**Bug severity if fails:** S2

### B60 — Date filter auto-swaps if from > to
**Priority:** P2
**Steps:** Pick from = 2026-03-01, to = 2026-01-01.
**Expected result:** Backend swaps internally (per comment "B9"). Results returned for Jan–Mar range. No empty result.
**Bug severity if fails:** S3

### B61 — Filter by category (via account detail filter)
**Priority:** P1
**Steps:** Account Detail → filter by category Food & Dining.
**Expected result:** Only expenses of that category for that account.
**Bug severity if fails:** S3

### B62 — Filter by min / max amount (account detail filter)
**Priority:** P1
**Steps:** Set min=1,000, max=5,000.
**Expected result:** Only txns in that range. Sending min=-1 / max="abc" should be ignored or error gracefully.
**Bug severity if fails:** S3

### B63 — Filter by status
**Priority:** P0 (Approved-only rule)
**Steps:** Default main list.
**Expected result:** Hardcoded `status=approved` in `fetchTransactionsPage`. Confirmed via network request inspection.
**Bug severity if fails:** S1

### B64 — Search by description (partial)
**Priority:** P1
**Steps:** Type "coff" in search.
**Expected result:** Debounce ~300 ms → `/transactions/search?q=coff&status=approved`. Matches all with "coffee", "Cofffee", case-insensitive.
**Bug severity if fails:** S2

### B65 — Search by numeric amount
**Priority:** P2
**Steps:** Type "500".
**Expected result:** Backend parses as number, returns any txn with `amount=500` OR description containing "500". Works per `search_transactions` endpoint.
**Bug severity if fails:** S3

### B66 — Search with special regex characters
**Priority:** P2
**Steps:** Search for "A+B" or "[test]" or ".".
**Expected result:** No crash, no 500. Results match by literal string where possible. Backend `$regex` with user input is a risk — verify at least there's no ReDoS / injection result that returns the whole db.
**Bug severity if fails:** S2

### B67 — Emoji in search
**Priority:** P3
**Steps:** Search 🍕. 
**Expected result:** Matches txns with 🍕 in description. Returns results consistently; at minimum does not crash.
**Bug severity if fails:** S4

### B68 — Sort by date descending (default)
**Priority:** P1
**Steps:** Default list.
**Expected result:** Newest first (`sort("date", -1)` backend). Tie-break on `created_at` stable.
**Bug severity if fails:** S3

### B69 — Pagination / infinite scroll
**Priority:** P1
**Pre-conditions:** 100+ approved txns.
**Steps:** Scroll to bottom; when last visible row is the last item, `loadMore()` fires.
**Expected result:** Next 30 appended. No duplicates. Spinner visible. When total reached, `hasMore = false` stops further loads.
**Bug severity if fails:** S2

### B70 — Pull to refresh
**Priority:** P1
**Steps:** Pull down on list.
**Expected result:** `refresh()` resets to page 1, reloads.
**Bug severity if fails:** S3

### B71 — 1000+ transactions performance
**Priority:** P2
**Pre-conditions:** Seed DB with 1,500 approved txns.
**Steps:** Scroll through list from top to bottom.
**Expected result:** Scroll stays 60fps on iPhone 17 Pro. Memory < 250 MB. No UI hitching.
**Bug severity if fails:** S3

### B72 — Combined filter + search
**Priority:** P2
**Steps:** Set filter type=Expense + search "uber".
**Expected result:** If iOS composes both queries, result is intersection; otherwise, search overrides filters (document the behavior and it should be consistent, not random).
**Bug severity if fails:** S3

### B73 — Empty state with pending count hint
**Priority:** P2
**Pre-conditions:** No approved txns, 3 pending.
**Steps:** Open list.
**Expected result:** Empty state with message "You have 3 transactions pending review" and a CTA to open pending queue or add manually.
**Bug severity if fails:** S3

### B74 — Ledger view (balance-running)
**Priority:** P2
**Steps:** Toggle to Ledger view.
**Expected result:** Each row shows running balance for the selected account. Zero-balance line correct. Transfers show both legs appropriately.
**Bug severity if fails:** S3

---

## Section 5 — Accounts CRUD & types

### B75 — Create Savings account
**Priority:** P0
**Steps:** + → Asset / Savings → name, account_number, opening_balance=10,000.
**Expected result:** Created with `balance=10,000`. Appears under Asset section.
**Bug severity if fails:** S1

### B76 — Create Current account
**Priority:** P1
**Steps:** Same but sub-type Current.
**Expected result:** Created. Icon `building.columns.fill`.
**Bug severity if fails:** S2

### B77 — Create Credit Card account
**Priority:** P0
**Steps:** Type = Liability, sub-type = Credit Card, opening_balance = 25,000 outstanding.
**Expected result:** Under Liability section; icon `creditcard.fill`; totalBalance subtracts its balance.
**Bug severity if fails:** S1

### B78 — Create Cash wallet
**Priority:** P1
**Steps:** Asset / Cash, opening 500.
**Expected result:** Created; icon `banknote.fill`.
**Bug severity if fails:** S2

### B79 — Create Digital Wallet
**Priority:** P1
**Steps:** Asset / Wallet or Digital Wallet, opening 1,200.
**Expected result:** Created; icon `wallet.pass.fill`.
**Bug severity if fails:** S2

### B80 — Create Investment (Demat) account
**Priority:** P1
**Steps:** Type = Investment, sub-type = Demat, broker_name="Zerodha".
**Expected result:** Created with `broker_name` persisted. Demat section in form shown only when investment+demat.
**Bug severity if fails:** S2

### B81 — Create Loan account (home loan)
**Priority:** P0
**Steps:** Type=Liability, sub-type=Loan, opening=40,00,000, rate=8.5, tenure=240, emi=34,713, emi_day=5, sanctioned=40,00,000.
**Expected result:** Created. Auto-generated recurring EMI transaction exists (`source=loan_emi`, `is_recurring=true`, `status=approved` but does NOT affect balance). Category "Loan EMI" auto-created if missing.
**Bug severity if fails:** S1

### B82 — Create Car Loan / Personal Loan
**Priority:** P1
**Steps:** Similar to B81 with different amounts.
**Expected result:** Same handling as home loan; amortization schedule renders correctly.
**Bug severity if fails:** S2

### B83 — Create Overdraft account
**Priority:** P1
**Steps:** Asset or Liability (depending on your setup), sub-type=Overdraft.
**Expected result:** Created. Special OD balance math applies to transfers (B04/B05).
**Bug severity if fails:** S2

### B84 — Create Equity account
**Priority:** P2
**Steps:** Type=Equity (used for owner's capital).
**Expected result:** Created under Equity section.
**Bug severity if fails:** S3

### B85 — Account type whitelist
**Priority:** P0
**Steps:** Attempt to send `account_type="foo"` via a debug build.
**Expected result:** Backend returns 400 "Invalid account_type". UI picker only offers the 4 valid types.
**Bug severity if fails:** S1

### B86 — Duplicate account detection
**Priority:** P1
**Steps:** Create "HDFC Savings" with number "1234". Create another with same name+number.
**Expected result:** 400 "Account 'HDFC Savings' already exists". No second account created.
**Bug severity if fails:** S2

### B87 — Edit account name/type/balance
**Priority:** P0
**Steps:** Swipe Edit on account → change name, currency, opening_balance.
**Expected result:** Saved. If `opening_balance` or `balance_as_of_date` changed → `recalculate_account_balance` runs automatically; balance reflects opening + approved txns after as-of date.
**Bug severity if fails:** S2

### B88 — Manual "recalculate balance" endpoint
**Priority:** P1
**Steps:** Trigger recalculate from account detail menu.
**Expected result:** `POST /accounts/{id}/recalculate` returns updated account. Excludes pending_review (only `status=approved` in the MongoDB query). Excludes `source=loan_emi` templates.
**Bug severity if fails:** S2

### B89 — Delete empty account (no txns)
**Priority:** P0
**Steps:** Create account → do not add txns → Delete.
**Expected result:** 200 "Account deleted"; removed from list.
**Bug severity if fails:** S1

### B90 — Delete account with existing transactions is blocked
**Priority:** P0
**Steps:** Account with 1+ txns → Delete.
**Expected result:** 400 "Cannot delete account with existing transactions". iOS shows error. User must delete/reassign txns first.
**Bug severity if fails:** S1

### B91 — Account detail — transactions tab
**Priority:** P1
**Steps:** Open account detail → Transactions tab.
**Expected result:** Only approved txns for that account (both primary and transfer-destination). Confirmed by ViewModel's filter `status=approved`.
**Bug severity if fails:** S2

### B92 — Account detail — balance card
**Priority:** P1
**Steps:** Verify balance, opening balance, currency, sub-type rendered.
**Expected result:** All match backend `/api/accounts/{id}/balance`. Currency symbol matches `Account.currency`.
**Bug severity if fails:** S3

### B93 — Account totals header
**Priority:** P1
**Steps:** Top of list shows "Total Balance".
**Expected result:** Sums assets + investments + equity, subtracts liabilities (per `totalBalance` computed property).
**Bug severity if fails:** S2

### B94 — AI-created account badge
**Priority:** P2
**Pre-conditions:** An account with `aiCreated=true`.
**Steps:** Render in list.
**Expected result:** Purple "AI" pill visible next to the name.
**Bug severity if fails:** S3

### B95 — Account type grouping order
**Priority:** P3
**Steps:** Create one of each of asset, liability, investment, equity.
**Expected result:** Sections ordered asset → liability → equity → investment per `typeOrder` in ViewModel.
**Bug severity if fails:** S4

### B96 — Search accounts by name, number, sub-type
**Priority:** P2
**Steps:** Type "HDFC" — matches name. Type "1234" — matches account number. Type "credit" — matches sub-type.
**Expected result:** All three match modes work via `filteredAccounts` computed.
**Bug severity if fails:** S3

---

## Section 6 — Loan / EMI / Amortization

### B97 — Amortization schedule renders correctly
**Priority:** P0
**Pre-conditions:** Loan account from B81.
**Steps:** Open Loan tab → Amortization.
**Expected result:** 240 rows (one per tenure month). Month 1 shows EMI=34,713 with `interest ≈ 28,333` and `principal ≈ 6,380`; outstanding decreases each row. Final row's outstanding rounds to 0.
**Bug severity if fails:** S1

### B98 — Amortization totals
**Priority:** P1
**Steps:** Verify `totalInterest` and `totalPayment` fields.
**Expected result:** `totalPayment = sum(emi)`, `totalInterest = sum(interest)`. Both positive. `totalPayment = outstanding + totalInterest` within rounding.
**Bug severity if fails:** S2

### B99 — Amortization requires all loan fields
**Priority:** P1
**Steps:** Try to open amortization on loan with missing rate.
**Expected result:** 400 "Loan details (interest rate, tenure, EMI) are required". UI shows message, not crash.
**Bug severity if fails:** S2

### B100 — Auto-created recurring EMI transaction
**Priority:** P0
**Pre-conditions:** B81 created.
**Steps:** Go to Transactions filtered by account=loan.
**Expected result:** One recurring EMI template (source=loan_emi, is_recurring=true, monthly, next emi date = next month's emi_day). Does NOT affect balances.
**Bug severity if fails:** S2

### B101 — Partial prepayment
**Priority:** P2
**Steps:** Add a manual expense of 1,00,000 against the loan account (principal prepayment). Re-open amortization.
**Expected result:** `payments_made` increments; `total_paid` = emi*paid_count historical + prepayment. Remaining schedule should reflect reduced outstanding on next recalculation (note: backend may not auto-recompute schedule post-prepayment — verify and flag).
**Bug severity if fails:** S3

### B102 — Loan EMI edits propagate to recurring template
**Priority:** P1
**Steps:** Edit loan account's `loan_emi_amount` to 35,000.
**Expected result:** The existing `loan_emi` recurring txn is updated (not duplicated) to 35,000 via `_create_loan_emi_recurring` upsert path.
**Bug severity if fails:** S2

### B103 — Loan EMI day of 31 falls back safely
**Priority:** P2
**Steps:** Set emi_day=31, create loan.
**Expected result:** No crash in Feb; `min(emi_day, 28)` clamps to 28 per backend logic.
**Bug severity if fails:** S3

### B104 — EMI "paid" status per month
**Priority:** P2
**Steps:** Make 3 manual EMI expense txns matching the loan's EMI amount.
**Expected result:** Amortization response shows `payments_made=3`, `months_remaining = tenure - 3`.
**Bug severity if fails:** S3

---

## Section 7 — Credit Card specifics

### B105 — Credit card outstanding is a liability
**Priority:** P0
**Steps:** Create CC with outstanding 25,000. Check totals.
**Expected result:** Total Balance subtracts 25,000. CC listed under Liability section.
**Bug severity if fails:** S1

### B106 — Pay credit card bill creates a transfer
**Priority:** P0
**Steps:** On CC detail → "Pay Bill" → source = HDFC Savings, amount = 25,000.
**Expected result:** Transfer txn created: HDFC -25,000, CC +25,000 (since CC is liability, "balance" drops). Both appear correctly in list.
**Bug severity if fails:** S1

### B107 — Billing cycle / statement balance / available credit
**Priority:** P2
**Steps:** View CC detail card.
**Expected result:** Fields for credit_limit, statement_balance, available_credit render if populated. If missing, UI hides them gracefully (no "null" string shown).
**Bug severity if fails:** S3

### B108 — Paying more than outstanding (overpayment)
**Priority:** P2
**Steps:** CC outstanding 500; transfer-pay 1,000.
**Expected result:** CC balance goes into negative territory (credit). No crash.
**Bug severity if fails:** S3

---

## Section 8 — Demat & Investment

### B109 — Upload valid Demat CSV
**Priority:** P1
**Pre-conditions:** Demat account. A sample CDSL CSV with 5 holdings.
**Steps:** Account Detail → Demat Statements → Upload CSV.
**Expected result:** Upload succeeds, statement appears with status "pending_approval", holdings list is parsed. After approval, transaction_ids are linked.
**Bug severity if fails:** S2

### B110 — Upload Demat PDF
**Priority:** P2
**Pre-conditions:** A CDSL PDF.
**Steps:** Same, but PDF.
**Expected result:** MIME type auto-derived (`application/pdf`), upload succeeds, parsed.
**Bug severity if fails:** S3

### B111 — Approve Demat statement
**Priority:** P1
**Steps:** Tap Approve on a pending demat statement.
**Expected result:** Status → "approved". Holdings become transactions linked to the investment account.
**Bug severity if fails:** S2

### B112 — Reject Demat statement
**Priority:** P1
**Steps:** Reject.
**Expected result:** Status → "rejected". Linked txns (if any staged) removed; none applied to balance.
**Bug severity if fails:** S2

### B113 — Upload malformed file
**Priority:** P1
**Steps:** Upload a .txt renamed to .csv with garbage contents.
**Expected result:** Graceful error ("Could not parse statement"). No partial state left behind.
**Bug severity if fails:** S2

### B114 — Upload file >10 MB
**Priority:** P2
**Steps:** Upload a 12 MB PDF.
**Expected result:** 400 "File too large (max 10MB)". iOS surfaces message.
**Bug severity if fails:** S3

### B115 — Positions view for Demat
**Priority:** P2
**Steps:** After approval, view Positions.
**Expected result:** Tabular positions with qty, avg price, LTV (if available). Total investment value matches account balance.
**Bug severity if fails:** S3

---

## Section 9 — Categories CRUD / Merge / Defaults

### B116 — Create top-level expense category
**Priority:** P0
**Steps:** Categories → + → name "Pets", type=Expense (from tab).
**Expected result:** Created; appears in tree alphabetically.
**Bug severity if fails:** S2

### B117 — Create subcategory under a parent
**Priority:** P0
**Steps:** Expand "Food & Dining" → + → "Tea stalls".
**Expected result:** Subcategory under correct parent; parent's count badge increments.
**Bug severity if fails:** S2

### B118 — Edit category name
**Priority:** P1
**Steps:** Swipe Edit → rename "Pets" → "Pet Care".
**Expected result:** Name updated everywhere including txns referencing this category (they reference by id, so auto-updates).
**Bug severity if fails:** S2

### B119 — Delete leaf category
**Priority:** P1
**Steps:** Swipe Delete on an empty subcategory.
**Expected result:** Deleted. If it has children, backend returns 400 "Delete subcategories first".
**Bug severity if fails:** S2

### B120 — Delete category with children is blocked
**Priority:** P0
**Steps:** Try to delete "Food & Dining" which has children.
**Expected result:** 400 "Delete subcategories first". iOS shows alert; does NOT silently cascade.
**Bug severity if fails:** S1

### B121 — Merge two categories
**Priority:** P1
**Steps:** Merge "Groceries" → "Food & Dining".
**Expected result:** All txns with category=Groceries now have category=Food & Dining. Groceries deleted. `POST /categories/merge` returns success.
**Bug severity if fails:** S2

### B122 — Merge category into itself is rejected
**Priority:** P2
**Steps:** Source = target = same id.
**Expected result:** 400 "Cannot merge a category into itself".
**Bug severity if fails:** S3

### B123 — Load default categories
**Priority:** P2
**Steps:** On fresh account, call defaults.
**Expected result:** Backend returns canonical list (Salary, Food & Dining, etc.).
**Bug severity if fails:** S3

### B124 — Type (income vs expense) is enforced
**Priority:** P1
**Steps:** On Income tab, create "Salary" income category. Try assigning it to an expense transaction.
**Expected result:** Transaction form should filter categories by `transactionType`; income cats only for income txns, expense cats only for expense. No mismatch possible.
**Bug severity if fails:** S2

### B125 — Color / icon fields (if implemented)
**Priority:** P3
**Steps:** Form includes color hex field — enter `#FF00AA`, `red`, `invalid`.
**Expected result:** Only valid 6-digit hex accepted. Named colors/invalid rejected. If color not yet implemented in form, mark N/A.
**Bug severity if fails:** S4

### B126 — Rename category reflects in transaction list
**Priority:** P2
**Steps:** Rename "Shopping" → "Retail". Go to Transactions list.
**Expected result:** Affected rows now show "Retail".
**Bug severity if fails:** S3

---

## Section 10 — Account sub-types

### B127 — Create new sub-type
**Priority:** P1
**Steps:** SubTypeManagerView → Asset tab → add "NRE Savings".
**Expected result:** Created; appears under Asset in the form's sub-type picker when Asset is selected.
**Bug severity if fails:** S2

### B128 — Edit sub-type name
**Priority:** P2
**Steps:** Rename "NRE Savings" → "NRE".
**Expected result:** Accounts with that sub-type text auto-display new label.
**Bug severity if fails:** S3

### B129 — Delete sub-type in use
**Priority:** P2
**Steps:** Delete a sub-type referenced by 1+ account.
**Expected result:** Either blocked with error OR deletes with accounts keeping the string but no longer linkable (document behavior). UI should warn.
**Bug severity if fails:** S3

### B130 — Sub-type grouped by account_type
**Priority:** P2
**Steps:** Confirm backend returns `{"sub_types": [...], "grouped": {...}}` and iOS filters by active tab.
**Expected result:** Credit Card appears under Liability only.
**Bug severity if fails:** S3

### B131 — Default sub-type seeding
**Priority:** P3
**Steps:** Fresh user — check sub-types list on first load.
**Expected result:** Canonical set pre-seeded (savings, current, credit_card, cash, digital_wallet, loan, overdraft, demat).
**Bug severity if fails:** S4

---

## Section 11 — Reconciliation (bank/CC statements)

### B132 — Upload `test_hdfc_statement.csv` via Reconciliation tab
**Priority:** P0
**Pre-conditions:** HDFC Savings account exists.
**Steps:** Reconciliation → + → pick sub-type=Savings, account=HDFC Savings, period 2026-03-01..2026-03-31, upload `test_hdfc_statement.csv`.
**Expected result:** Statement row created with status "parsing", then transitions to "parsed". Entry count > 0 visible on row.
**Bug severity if fails:** S1

### B133 — Parse polling via timer
**Priority:** P1
**Steps:** Open statement detail immediately after upload.
**Expected result:** Polling timer fires every 2 s; status changes to "parsed" within reasonable time; entries populate.
**Bug severity if fails:** S2

### B134 — Upload PDF statement
**Priority:** P1
**Steps:** Upload an HDFC PDF statement.
**Expected result:** MIME = `application/pdf`; parse succeeds (LLM-driven). Entries populated.
**Bug severity if fails:** S2

### B135 — Upload locked PDF, unlock with password
**Priority:** P2
**Pre-conditions:** Password-protected PDF.
**Steps:** Upload → status becomes `locked` or similar → Unlock sheet opens → enter correct password → save.
**Expected result:** `POST /statements/{id}/unlock` succeeds; parsing restarts. Wrong password returns 400 with message.
**Bug severity if fails:** S3

### B136 — Upload wrong format (e.g., .xlsx)
**Priority:** P1
**Steps:** Attempt to upload `.xlsx`.
**Expected result:** Backend 400 "Only CSV and PDF files are supported". UI surface error; no statement row created.
**Bug severity if fails:** S2

### B137 — Reconcile: auto-match confidence
**Priority:** P0
**Pre-conditions:** Parsed statement + 10 existing ledger txns overlap.
**Steps:** Tap Reconcile.
**Expected result:** `matched`, `missing_from_ledger`, `missing_from_statement`, `conflicts` populated. High-confidence exact matches (date+amount+desc similar) in `matched`.
**Bug severity if fails:** S1

### B138 — Manual match (unmatched entry → existing ledger)
**Priority:** P1
**Steps:** For an item in `missing_from_ledger`, tap "Link to existing" and pick a ledger txn.
**Expected result:** If supported, moves entry to `matched`. Otherwise mark N/A.
**Bug severity if fails:** S3

### B139 — Add missing to ledger (bulk)
**Priority:** P0
**Steps:** "Add all missing to ledger".
**Expected result:** `POST /add-missing` creates new pending_review txns for each missing entry. They appear in Pending tab, NOT in approved/dashboard yet (Approved-only rule).
**Bug severity if fails:** S1

### B140 — Reject statement
**Priority:** P1
**Steps:** Tap Reject on parsed statement.
**Expected result:** Status → rejected. No txns created. Dashboard unaffected.
**Bug severity if fails:** S2

### B141 — Approve statement converts entries to transactions
**Priority:** P0
**Steps:** After reconciling + reviewing, tap Approve.
**Expected result:** `POST /approve` creates transactions for categorized entries; `transactionsCreated` in response. Statement status → "approved". Balance updates; per Approved-only rule, only these post-approval txns count.
**Bug severity if fails:** S1

### B142 — Delete statement
**Priority:** P1
**Steps:** Swipe Delete on a statement.
**Expected result:** `DELETE /statements/{id}` removes it. If associated approved txns exist, they remain (document behavior) or prompt for cleanup.
**Bug severity if fails:** S2

### B143 — Re-audit parsed statement
**Priority:** P2
**Steps:** Tap Re-audit.
**Expected result:** Re-runs parsing and audit. Status cycles back; results refresh.
**Bug severity if fails:** S3

### B144 — Duplicate detection within a statement
**Priority:** P1
**Pre-conditions:** CSV with two identical rows (same date, amount, desc).
**Steps:** Upload.
**Expected result:** Parser flags second row as potential duplicate (or at least both appear and reconciler matches only one to ledger; second ends up in `missing_from_ledger`). No silent drop of rows.
**Bug severity if fails:** S2

### B145 — Category update on parsed entry
**Priority:** P2
**Steps:** In statement detail, tap a parsed entry → change category.
**Expected result:** `PATCH /entries/{i}` returns updated entry. List updates in-place.
**Bug severity if fails:** S3

### B146 — Bulk categorize all entries
**Priority:** P2
**Steps:** Tap "Categorize all" → pick category → confirm.
**Expected result:** `POST /bulk-categorize` sets every entry to that category. Parsed entries reload.
**Bug severity if fails:** S3

### B147 — Upload CSV with wrong header structure
**Priority:** P2
**Steps:** Random CSV.
**Expected result:** `parse_csv_statement` surfaces a graceful error; statement status=failed (or parsed with 0 entries). iOS shows "No entries parsed".
**Bug severity if fails:** S3

### B148 — Period auto-derivation when user omits
**Priority:** P2
**Steps:** Upload with period_from/period_to blank.
**Expected result:** Reconcile endpoint falls back to min/max of parsed dates (per backend code). Still works.
**Bug severity if fails:** S3

### B149 — Reconcile with parsing still in progress is rejected
**Priority:** P1
**Steps:** Upload a big PDF, immediately hit Reconcile.
**Expected result:** 400 "Statement still being parsed". UI disables Reconcile while status=parsing.
**Bug severity if fails:** S2

### B150 — Reconcile with zero parsed entries is rejected
**Priority:** P2
**Steps:** Upload empty CSV.
**Expected result:** 400 "No entries found in statement".
**Bug severity if fails:** S3

### B151 — Reconciliation only considers approved ledger txns
**Priority:** P0 (Approved-only rule)
**Pre-conditions:** Some pending_review txns in the statement's period.
**Steps:** Reconcile.
**Expected result:** Pending txns are ignored in `missing_from_statement` calculation (backend filters `status=approved`). Statement entries matching pending-review ledger items still appear as `missing_from_ledger`.
**Bug severity if fails:** S1

### B152 — BillUploadParserView for single-invoice PDFs
**Priority:** P2
**Pre-conditions:** A single-bill PDF.
**Steps:** Open Purchases → Upload bill → use the parser view.
**Expected result:** Parses vendor, amount, date. User confirms → creates bill entry + optionally a pending_review expense txn.
**Bug severity if fails:** S3

---

## Section 12 — Cross-cutting (money, time, locale, offline, a11y, dark mode)

### B153 — Indian number formatting (lakhs/crores) under `en-IN`
**Priority:** P1
**Pre-conditions:** Device locale = English (India).
**Steps:** View an amount of 1,23,45,678.
**Expected result:** CurrencyText renders as ₹1,23,45,678 (Indian grouping), not 12,345,678.
**Bug severity if fails:** S2

### B154 — International grouping under `en-US`
**Priority:** P2
**Steps:** Switch device locale to English (US).
**Expected result:** 12,345,678 with thousand commas; currency symbol still matches account currency (default ₹ for INR accounts).
**Bug severity if fails:** S3

### B155 — Currency mismatch display
**Priority:** P2
**Steps:** Create USD account; open detail.
**Expected result:** `$` symbol used; amounts not mis-labeled with ₹.
**Bug severity if fails:** S3

### B156 — Timezone: 31 Dec 23:59 IST
**Priority:** P1
**Steps:** Create a txn with date 31 Dec at 23:59 local time.
**Expected result:** Stored as `2026-12-31` (backend stores yyyy-MM-dd only). Reports group it into December, not January. Confirm by changing system timezone to UTC; date still reads 31 Dec.
**Bug severity if fails:** S2

### B157 — DST transitions don't shift dates
**Priority:** P3
**Steps:** Set device to a locale observing DST, span the transition day.
**Expected result:** Dates stable because we strip time.
**Bug severity if fails:** S4

### B158 — Offline: list view shows cached data
**Priority:** P2
**Steps:** Load list online → enable airplane mode → pull refresh.
**Expected result:** Previous list still visible; error toast says "Offline". No blank screen.
**Bug severity if fails:** S3

### B159 — Offline: reconcile upload fails gracefully
**Priority:** P2
**Steps:** Airplane mode → try to upload statement.
**Expected result:** Clear "Network unavailable" error; form preserves input.
**Bug severity if fails:** S3

### B160 — Keyboard: form scrolls input above keyboard
**Priority:** P1
**Steps:** Focus amount/description fields on iPhone SE.
**Expected result:** Field stays visible; keyboard doesn't cover Save button. Done key dismisses. Next-field focus works.
**Bug severity if fails:** S2

### B161 — Keyboard: decimal pad blocks letters
**Priority:** P2
**Steps:** Focus amount; try to paste "abc".
**Expected result:** Pasted text stripped to digits+dot, or rejected silently. `Double(openingBalance)` safe.
**Bug severity if fails:** S3

### B162 — VoiceOver on transaction row
**Priority:** P2
**Steps:** Enable VoiceOver → focus a row.
**Expected result:** Reads description, amount, category, account, date in a logical order (e.g., "Lunch, 500 rupees, expense, Food & Dining, HDFC Savings, April 24 2026").
**Bug severity if fails:** S3

### B163 — VoiceOver on swipe-action buttons
**Priority:** P3
**Steps:** Swipe on a row with VoiceOver.
**Expected result:** Edit and Delete actions announced and activatable.
**Bug severity if fails:** S4

### B164 — Dynamic Type scales
**Priority:** P2
**Steps:** Set Dynamic Type to XXL; navigate every Domain B screen.
**Expected result:** No truncation of amounts. Layout wraps; actions reachable.
**Bug severity if fails:** S3

### B165 — Dark mode — Transaction list
**Priority:** P2
**Steps:** Switch to Dark Mode.
**Expected result:** Background is dark (`spentyBgPrimary`); text readable; no white flashes; icons keep contrast.
**Bug severity if fails:** S3

### B166 — Dark mode — Transaction form
**Priority:** P2
**Steps:** Open new transaction form in dark mode.
**Expected result:** Form fields readable; section headers visible; pickers dark-themed.
**Bug severity if fails:** S3

### B167 — Dark mode — Account list & detail
**Priority:** P2
**Steps:** Dark mode, navigate account list, group headers, detail screen.
**Expected result:** All text contrast AA or better. Charts (balance trend) render with dark-appropriate palette.
**Bug severity if fails:** S3

### B168 — Dark mode — Reconciliation statement detail
**Priority:** P2
**Steps:** Dark mode → open parsed statement.
**Expected result:** Entries list and badges readable; StatusBadge colors pass AA.
**Bug severity if fails:** S3

### B169 — Dark mode — Categories screen + form
**Priority:** P3
**Steps:** Dark mode → Categories + editor.
**Expected result:** Disclosure indicators, swipe actions, backgrounds all dark themed.
**Bug severity if fails:** S4

### B170 — Landscape orientation on iPad
**Priority:** P3
**Steps:** iPad Pro landscape, navigate Domain B.
**Expected result:** Lists use wider layout; forms remain centered; no clipping.
**Bug severity if fails:** S4

---

## Section 13 — Sanity / regression gotchas

### B171 — Approved-only rule — Dashboard summary includes only approved
**Priority:** P0 (Approved-only rule, explicit)
**Pre-conditions:** 5 approved expenses of 1000 each + 3 pending_review expenses of 10,000 each.
**Steps:** Open Dashboard → view Total Expense this month.
**Expected result:** Shows 5,000 (approved only). Does NOT include the 30,000 pending. Per `TransactionsViewModel.fetchTransactionsPage`'s hardcoded `status=approved`, and backend dashboard aggregates must also filter `status=approved`.
**Bug severity if fails:** S1

### B172 — Approved-only rule — Cash Flow
**Priority:** P0 (Approved-only rule)
**Steps:** Same data, open Cash Flow screen.
**Expected result:** Monthly cash flow bars reflect only approved sums.
**Bug severity if fails:** S1

### B173 — Approved-only rule — Reports by category
**Priority:** P0 (Approved-only rule)
**Steps:** Open Reports → By Category.
**Expected result:** Bars/pies for only approved txns; pending excluded.
**Bug severity if fails:** S1

### B174 — Approved-only rule — Account balance
**Priority:** P0 (Approved-only rule)
**Steps:** With the pending set above on Account A, open Account A detail.
**Expected result:** Balance includes only the 5 approved expenses (-5,000). Does not include any of the 30,000 pending.
**Bug severity if fails:** S1

### B175 — AI-recurring rule — UPI person-to-person is not recurring
**Priority:** P0 (AI-recurring rule)
**Pre-conditions:** A UPI P2P SMS/email parsed.
**Steps:** Open the pending txn.
**Expected result:** `is_recurring=false`. Backend prompt explicitly says P2P UPI ≠ recurring.
**Bug severity if fails:** S1

### B176 — AI-recurring rule — One-off insurance premium is not recurring
**Priority:** P0 (AI-recurring rule)
**Pre-conditions:** Insurance one-time premium email.
**Steps:** Open pending.
**Expected result:** `is_recurring=false`. User can promote later.
**Bug severity if fails:** S1

### B177 — AI category guess is allowed and preserved
**Priority:** P1 (User rule)
**Pre-conditions:** Pending email where AI picked a category.
**Steps:** Open form without changing anything → Approve.
**Expected result:** Approved with AI's category. No warning. Per user rule "categories CAN be guessed".
**Bug severity if fails:** S3

### B178 — Transaction list filter retains state across tab switches
**Priority:** P3
**Steps:** Apply filter type=Income → switch to Accounts tab → switch back.
**Expected result:** Filter still applied. List correct.
**Bug severity if fails:** S4

### B179 — Fast tap (double-tap + spam)
**Priority:** P2
**Steps:** Rapidly tap Save 10x on transaction form.
**Expected result:** Only one create request; Save button disabled while `isSaving=true`.
**Bug severity if fails:** S3

### B180 — Memory on rapid form open/close
**Priority:** P3
**Steps:** Open/close transaction form 50 times via + button.
**Expected result:** No leak (Instruments leaks tool). Memory returns to baseline.
**Bug severity if fails:** S4

### B181 — Sheet dismissal while saving
**Priority:** P2
**Steps:** Tap Save → immediately swipe sheet down while `isSaving=true`.
**Expected result:** Sheet dismissal blocked (`interactiveDismissDisabled(isSaving)` on CategoryFormView pattern; verify same on txn form). Or completes save then dismisses. No orphan write.
**Bug severity if fails:** S3

### B182 — Error banner auto-dismiss
**Priority:** P3
**Steps:** Trigger a network error.
**Expected result:** ErrorBanner appears; has a close button; can dismiss. Does NOT block tap-through to rest of UI after dismissal.
**Bug severity if fails:** S4

### B183 — Deep link to transaction detail (if implemented)
**Priority:** P3
**Steps:** Open `spentyai://transaction/{id}`.
**Expected result:** App opens at that txn. If not implemented, skip.
**Bug severity if fails:** S4

### B184 — Share transaction
**Priority:** P3
**Steps:** Share via system share sheet.
**Expected result:** Text / JSON summary; includes amount, date, description, category.
**Bug severity if fails:** S4

---

## Coverage Summary

| Bucket | Cases |
|---|---|
| Transactions CRUD (create/edit/delete/bulk/concurrency) | B01–B42 |
| Pending review (Approved-only + AI-recurring rules explicit) | B43–B56 |
| List, filter, search, sort, pagination | B57–B74 |
| Accounts CRUD + all types | B75–B96 |
| Loans / EMI / amortization | B97–B104 |
| Credit card | B105–B108 |
| Demat & investment | B109–B115 |
| Categories | B116–B126 |
| Account sub-types | B127–B131 |
| Reconciliation (CSV, PDF, unlock, reconcile, approve, reject) | B132–B152 |
| Money / time / locale / offline / a11y / dark mode / landscape | B153–B170 |
| Approved-only rule regression + AI-recurring rule + misc polish | B171–B184 |

**Total test cases:** 184

**P0 count (must pass before ship):** ~45 (every CRUD happy path, Approved-only rule across all surfaces, AI-recurring rule, account delete guard rails, reconciliation match/approve, loan amortization accuracy).

**Explicit user-feedback hard requirements with dedicated cases:**
- Approved-only: B35, B43, B44, B55, B63, B88, B91, B139, B141, B151, B171, B172, B173, B174.
- AI must never assume is_recurring unless explicitly evidenced: B49, B50, B175, B176.
- AI can guess categories: B48, B51, B177.
