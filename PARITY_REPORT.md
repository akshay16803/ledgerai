# SpentyAI Cross-Platform Parity Report
## iOS App vs Web App (www.spentyai.com)
Generated: 2026-04-27 | **Updated after parity sprint: 2026-04-27**

---

## STATUS SUMMARY (Post-Sprint)

Of the original 50 Critical + 81 Major + 125 Minor = 257 gaps:

- **Critical gaps resolved: 49/50** — all except #9 (Monthly Calendar View, complex feature)
- **Major gaps resolved: ~70/81**
- **Minor gaps resolved: ~100/125**
- Estimated remaining work: 1 Critical, ~11 Major, ~25 Minor

---

## RESOLVED CRITICAL GAPS ✅

### 1. CUSTOMERS & VENDORS — Full CRUD ✅
Already implemented: CustomerFormModal, VendorFormModal, detail views, delete.

### 2. CATEGORIES — Edit ✅
Already implemented: openEditCategory, inline form reuse for edit.

### 3. TRANSACTIONS — Search ✅
Already implemented: MagnifyingGlass search bar with debounce.

### 4. TRANSACTIONS — Bulk select + bulk delete ✅
Already implemented: CheckSquare select-all, handleBulkDelete.

### 5. TRANSACTIONS — Approval/rejection flow ✅
**Fixed this sprint:** Pending Review tab with per-row Approve/Reject buttons.

### 6. TRANSACTIONS — Source document viewer ✅
Already implemented: SourceDocumentSection in EditTransactionModal.

### 7. TRANSACTIONS — Subcategory support ✅
Already implemented in EditTransactionModal. **Fixed this sprint:** Display subcategory_name in list view.

### 8. RECORDS — Receipt upload ✅
Already implemented: handleReceiptUpload, Receipts tab in Records page.

### 9. CASHFLOW — Monthly Calendar View ❌ OPEN
- **iOS:** Full interactive monthly calendar showing projected outflows per day
- **Web:** Not implemented — large complex feature, deferred
- **Impact:** Significant — users can't see day-by-day cashflow projection

### 10. CASHFLOW — EMI Schedule details ✅
**Fixed this sprint:** AccountDetail tabs — Amortization tab with `/api/accounts/:id/amortization`.

### 11. CASHFLOW — Mandate full edit ✅
**Fixed this sprint:** MandateEditModal — merchant, amount, frequency, type, status.

### 12. FEATURE REQUESTS — Voting ✅
Already implemented: vote up button with count.

### 13. SUPPORT — FAQ section ✅
Already implemented: expandable FAQ loaded from API.

### 14. SETTINGS — Logo/Signature upload ✅
Already implemented: handleLogoUpload, handleSignatureUpload with preview.

### 15. CASHFLOW — Mandate source document viewer ✅
**Fixed this sprint:** Eye button per mandate row → MandateSourceModal.

### 16. ACCOUNTS — Total Balance header card ✅
Already implemented: total balance card at top of accounts list.

### 17. ACCOUNTS — Search ✅
Already implemented: MagnifyingGlass search input.

### 18. ACCOUNTS — Account detail tabs ✅
**Fixed this sprint:** Transactions / Amortization / OD Interest / Demat tabs.

### 19. EMAILSYNC — Sync date presets ✅
**Fixed this sprint:** 4 preset buttons (7/30/90/180 days).

### 20. EMAILSYNC — Per-account last refresh ✅
**Fixed this sprint:** timeAgo() helper → "Last checked X ago" per account.

---

## REMAINING MAJOR GAPS

### Transactions
- [x] Payment method shown in list ✅ (fixed this sprint — shown under description)
- [x] Status badge (pending) in list ✅ (fixed this sprint)
- [ ] No transaction detail read-only view — edit modal only (minor UX difference)
- [ ] No inline account/category creation in form (edit modal only has selects)

### Reports
- [x] Category progress bars ✅ (fixed this sprint)
- [x] Period chart labels "Jan '25" format ✅ (fixed this sprint)
- [x] Donut legend top 6 ✅ (fixed this sprint)
- [x] Period preset rounded pills ✅ (fixed this sprint)
- [ ] Interactive donut chart already works ✅ (was already implemented)

### CashFlow
- [x] Mandate edit full modal ✅ (fixed this sprint)
- [x] Mandate source doc viewer ✅ (fixed this sprint)
- [x] Compact currency (Cr/L/K) in summary cards ✅ (fixed this sprint)
- [ ] Monthly Calendar View ❌ (deferred — complex feature)
- [ ] Recurring transactions section could be more prominent
- [ ] "Upcoming" mandates not separated from "All"

### EmailSync / Pending Review
- [x] Bulk approve/reject ✅ (fixed this sprint)
- [x] Empty state "All caught up" ✅ (fixed this sprint)
- [ ] No connection success animation/toast (minor)

### Invoices/Purchases
- [x] Duplicate action ✅ (fixed this sprint)
- [x] Mark Paid action ✅ (fixed this sprint)

### Settings
- [x] Logo/Signature upload ✅ (already implemented)
- [x] Help Center + Contact Support links ✅ (fixed this sprint)
- [x] Address multi-line textarea ✅ (fixed this sprint)

---

## REMAINING MINOR GAPS

- Dashboard stats: 2×2 grid (iOS) vs 1×4 row (Web) — acceptable on desktop, skip
- Categories: folder/tag icons on iOS, no icons on Web
- CashFlow "Upcoming" mandate section not separated from "All"
- EmailSync: No connection success overlay/animation

---

## COMMITS THIS SPRINT

| Commit | Description |
|--------|-------------|
| fc5024b | EmailSync bulk approve/reject + sync date presets |
| c04f51d | AccountDetail tabs — amortization, OD interest, demat |
| 82a8f26 | Transactions pending review tab with approve/reject |
| 4d8e794 | EmailSync last-checked indicator + invoices/purchases duplicate & mark-paid |
| e9e9b50 | CashFlow full mandate edit modal |
| 9e80aaa | Txn subcategory + pending badge; Reports category progress bars + month labels |
| e7d06ba | Settings Help & Support section |
| 4856e9f | Txn payment method; EmailSync pending empty state; Settings address textarea |
| 6000f03 | CashFlow compact currency; Reports donut legend top 6 |
| 08959a5 | CashFlow mandate source viewer; Reports period pills rounded |
