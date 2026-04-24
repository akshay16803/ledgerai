# Domain E — Invoices, Bills, PDFs, Customers, Vendors, Support, Billing Plans, Help Center, Refund Policy

Expert QA test plan for the SpentyAI iOS app.

Repo: `ledgerai` / branch: `emergent`
Scope paths:
- iOS Features: `Invoices/`, `Purchases/` (= Bills), `Customers/`, `Vendors/`, `Support/`, `Billing/`, `FeatureRequests/`
- Backend: `backend/server.py` (FastAPI)
- Web (Help/Refund/Legal): `src/pages/HelpCenter.jsx`, `src/pages/RefundPolicy.jsx`, `src/pages/Landing.jsx`, `public/privacy.html`, `public/terms.html`

---

## PRE-TEST ADVISORIES (read before executing tests)

### A1. PDF backend — VERIFIED: returns real `application/pdf` bytes
Commit `6d2b291` holds. In `backend/server.py`:
- `GET /api/invoices/{invoice_id}/pdf` (L12826) returns `Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": ...})` — confirmed real bytes, not JSON.
- `GET /api/bills/{bill_id}/pdf` (L13508) uses the same `Response(content=pdf_bytes, media_type="application/pdf")` pattern — confirmed real bytes.
- Generator `_generate_invoice_pdf_bytes` (L12601) uses `fpdf2`, returns `bytes(pdf.output())`.

iOS side matches:
- `InvoiceRepository.fetchPDF(id:)` (L139–141) calls `api.getRaw(APIEndpoints.invoicePDF(id))` — raw `Data`.
- `PurchaseRepository.fetchPDF` (L191–193) calls `api.getRaw(APIEndpoints.billPDF(id))` — raw `Data`.
- `InvoicePreviewView` / `PurchasePreviewView` render with `PDFDocument(data:)` + `PDFKitView`.

No mismatch. The PDF-loads-as-JSON regression is closed.

### A2. Critical PDF rendering limitations (treat as known-defect backdrop for all PDF tests)
`_generate_invoice_pdf_bytes` uses **`Helvetica` font in latin-1 encoding**:
```python
pdf = FPDF(orientation="P", unit="mm", format="A4")
pdf.set_font("Helvetica", "B", 16)
...
def safe(text):
    return str(text).replace("₹", "Rs. ").encode("latin-1", "replace").decode("latin-1")
```
Implications any PDF test must account for:
- The rupee glyph `₹` is hard-replaced with the ASCII string `"Rs. "` in generated PDFs. Expected on-PDF: `Rs. 12,34,567.89`, not `₹12,34,567.89`.
- **Devanagari / Hindi / any non-latin-1 character is NOT rendered** — `encode("latin-1", "replace")` turns each such codepoint into `?`. A customer named `राम कुमार` will appear as `??? ??????` in the PDF. Flag as a shipping defect even though it is consistent with the code.
- No logo embedding exists in `_generate_invoice_pdf_bytes`; there is no `pdf.image(...)` call. Settings `firm_logo_url` is not consumed by the PDF generator. Any test that expects a logo on the PDF is expected to fail.
- "Amount in words" (`amount_in_words`) is persisted on invoice/bill documents (see `amount_to_words_inr`, L11863) but is **not written onto the PDF**; it is only an API-side field. "Grand total in words" tests should target the API response / detail-view, not the PDF.

### A3. No in-app Help Center / Refund / Settings→Legal entry points
`grep` across `ios/SpentyAI/SpentyAI/Features/Settings/` finds zero matches for `help`, `refund`, `privacy`, `terms`, or `legal` (case-insensitive). The only in-app web links to legal content exist in:
- `Features/Auth/LoginView.swift:121` — markdown links to `https://spentyai.com/terms` and `https://spentyai.com/privacy`
- `Features/Onboarding/SubscriptionPaywall.swift:329,331` — same two links

Expect failures for any test case that asserts Settings → Help Center, Settings → Refund Policy, or Settings → Legal. These are being tested to produce actionable bug reports, not to pass.

### A4. Support is write-only
Backend exposes only `POST /api/support/ticket` and `GET /api/support/faq`. There is **no** endpoint to list/view/reply/close a user's own tickets. `SupportRepository` matches. `SupportTicket` model has no attachment/screenshot field. Tests for "view status / reply / close" are expected to fail at the "feature does not exist" level — severity downgraded to P2 and logged as a product gap.

### A5. "Send invoice via email / WhatsApp / SMS" is client-side share only
No `/api/invoices/{id}/send` endpoint exists. Sending happens entirely through `UIActivityViewController` in `InvoicePreviewView.swift:67–70` sharing the PDF `Data`. Tests for delivery receipts, SMTP logs, etc. are out of scope because the server never participates.

### A6. Bills module lives in `Features/Purchases/`
Filesystem check: `ios/.../Features/` has no `Bills/` directory; the bills feature is implemented under `Purchases/` (`PurchaseListView`, `PurchaseFormView`, `PurchasePreviewView`, `PurchaseRepository`, `PurchasesViewModel`, `RecordBillPaymentView`, `BillUploadParserView`). Model is `Core/Models/Bill.swift`. Tests reference "Bills" consistently with the user-facing label.

### A7. Test environment
- Build: TestFlight / Xcode USB install (user preference: USB).
- Accounts: a fresh paid-plan account, a fresh free-trial account, a past-due account (simulate via DB), and an account with ≥500 invoices / 500 bills / 500 customers / 500 vendors for perf tests.
- Devices: iPhone SE (smallest), iPhone 15 Pro (primary), iPad (if supported).
- iOS: 17 and 18. Dark mode and Light mode. Default, XXL, and AX5 Dynamic Type.
- Languages: EN, HI, Hinglish (in-app `LocalizationManager`).

---

## Legend
- **P0** blocks ship. **P1** ship-blocking for affected users. **P2** degraded experience. **P3** polish / edge case.
- **Bug severity if fails:** S1 = data loss / crash / wrong money; S2 = broken feature; S3 = wrong content / bad UX; S4 = cosmetic.

---

## Section 1 — Invoices CRUD

### E01 — Create draft invoice with minimum required fields
**Priority:** P0
**Pre-conditions:** Signed in, paid plan, at least one customer exists.
**Steps:**
1. Invoices tab → FAB/`+`.
2. Pick customer, enter invoice number auto-suggested, date today, one line item: description "Test", qty 1, rate 1000, GST 0%.
3. Save.
**Expected result:** Invoice created with status `draft`/`unpaid`, grand_total 1000, appears at top of list, `POST /api/invoices` returns 201 with `invoiceId`.
**Bug severity if fails:** S1

### E02 — Invoice number auto-increment from `/invoices/next-number`
**Priority:** P1
**Pre-conditions:** Last invoice was `INV-0007`.
**Steps:** Open new invoice form.
**Expected result:** `invoiceNumber` prefilled `INV-0008` (via `GET /api/invoices/next-number`). Form still allows manual override.
**Bug severity if fails:** S2

### E03 — Invoice number uniqueness enforced
**Priority:** P1
**Pre-conditions:** `INV-0008` already exists.
**Steps:** Create new invoice, manually change number to `INV-0008`, save.
**Expected result:** Error toast or inline validation: "Invoice number already exists." No duplicate row in DB.
**Bug severity if fails:** S2

### E04 — Edit existing draft invoice
**Priority:** P0
**Pre-conditions:** Draft invoice exists.
**Steps:** Open detail → Edit → change line-item rate from 1000 to 1500 → Save.
**Expected result:** `PUT /api/invoices/{id}` returns 200; list and detail reflect new grand_total; updated_at timestamp advances.
**Bug severity if fails:** S1

### E05 — Cancel edit discards pending changes
**Priority:** P2
**Pre-conditions:** Draft invoice open in edit mode.
**Steps:** Change rate, tap Cancel (no save).
**Expected result:** Sheet dismisses; detail view shows original values; no PUT fires.
**Bug severity if fails:** S3

### E06 — Delete draft invoice via swipe
**Priority:** P0
**Pre-conditions:** Draft invoice in list.
**Steps:** Swipe left on row → Delete → confirm.
**Expected result:** `DELETE /api/invoices/{id}` 204; row removed; linked transaction (if any) also removed; undo toast absent or present per spec.
**Bug severity if fails:** S1

### E07 — Delete invoice that has a recorded payment
**Priority:** P1
**Pre-conditions:** Partial-paid invoice with one linked transaction.
**Steps:** Attempt delete.
**Expected result:** Either blocked with "Cannot delete invoice with payments" OR cascading delete that also removes the linked transaction and recalculates account balance. No dangling transaction.
**Bug severity if fails:** S1

### E08 — Duplicate invoice creates new doc with today's date and new number
**Priority:** P1
**Pre-conditions:** Paid invoice INV-0005 exists.
**Steps:** Detail → Duplicate.
**Expected result:** `POST /api/invoices/{id}/duplicate` returns a new invoice with fresh `invoiceId`, new sequential number, today's date, status `unpaid`, no payments copied, line items copied.
**Bug severity if fails:** S2

### E09 — Invoice list pagination / infinite scroll (500 items)
**Priority:** P1
**Pre-conditions:** Seed DB with 500 invoices for this user.
**Steps:** Open Invoices tab → scroll to bottom.
**Expected result:** Smooth 60fps scrolling, no memory spike > 250MB, list loads incrementally or fully in < 3s; search filter works on the full set.
**Bug severity if fails:** S2

### E10 — Pull-to-refresh reloads list
**Priority:** P2
**Pre-conditions:** On Invoices list.
**Steps:** Pull down past threshold.
**Expected result:** `GET /api/invoices` re-fetches; stats card updates; pull indicator animates and dismisses.
**Bug severity if fails:** S3

### E11 — Invoice search by number and customer name
**Priority:** P1
**Steps:** Type "INV-0005" in search; type customer name partial.
**Expected result:** Client-side filtering narrows list; diacritic-insensitive match for customer names.
**Bug severity if fails:** S3

### E12 — Filter by status (draft / sent / paid / overdue)
**Priority:** P1
**Steps:** Tap each status chip in turn.
**Expected result:** List correctly segments by `paymentStatus`; "overdue" uses today > dueDate AND status != "paid".
**Bug severity if fails:** S2

### E13 — Invoice stats card totals match backend
**Priority:** P0
**Steps:** Check top card: Total Invoiced / Paid / Outstanding / Overdue.
**Expected result:** Matches `GET /api/invoices/stats` exactly. Pending-review transactions must NOT inflate any figure (per user policy).
**Bug severity if fails:** S1

---

## Section 2 — Invoice Line Items: Discount, Tax, Rounding, Words

### E14 — Add/remove multiple line items
**Priority:** P0
**Steps:** Add 5 line items; delete the 3rd via trailing swipe; save.
**Expected result:** Remaining 4 line items persisted in order; subtotal recomputes.
**Bug severity if fails:** S1

### E15 — GST 0% computes zero tax
**Priority:** P0
**Steps:** qty 2, rate 100, tax 0%.
**Expected result:** taxable 200, cgst 0, sgst 0, igst 0, grand_total 200.
**Bug severity if fails:** S1

### E16 — GST 5% intra-state splits CGST 2.5% / SGST 2.5%
**Priority:** P0
**Pre-conditions:** Customer state == firm state.
**Steps:** qty 1, rate 1000, tax 5%.
**Expected result:** cgst 25, sgst 25, igst 0, grand_total 1050.
**Bug severity if fails:** S1

### E17 — GST 12% intra-state split 6/6
**Priority:** P0
**Steps:** qty 1, rate 1000, tax 12%.
**Expected result:** cgst 60, sgst 60, igst 0, grand_total 1120.
**Bug severity if fails:** S1

### E18 — GST 18% intra-state split 9/9
**Priority:** P0
**Steps:** qty 1, rate 1000, tax 18%.
**Expected result:** cgst 90, sgst 90, igst 0, grand_total 1180.
**Bug severity if fails:** S1

### E19 — GST 28% intra-state split 14/14
**Priority:** P0
**Steps:** qty 1, rate 1000, tax 28%.
**Expected result:** cgst 140, sgst 140, igst 0, grand_total 1280.
**Bug severity if fails:** S1

### E20 — GST 18% inter-state uses IGST only
**Priority:** P0
**Pre-conditions:** Customer state != firm state (e.g., firm MH, customer KA).
**Steps:** qty 1, rate 1000, tax 18%.
**Expected result:** igst 180, cgst 0, sgst 0, grand_total 1180. `isInterState` flag in `InvoiceFormView` resolves to true on edit.
**Bug severity if fails:** S1

### E21 — Line-level discount_percent reduces taxable amount
**Priority:** P0
**Pre-conditions:** AI-draft path (discount input only exposed via AI parse / edit JSON).
**Steps:** Create invoice via AI with discount_percent 10 on a ₹1000 × 1 line at 18%.
**Expected result:** Server formula `taxable = qty*rate*(1 - discount_percent/100)` → taxable 900, tax 162, total 1062. Verify `POST /api/invoices` response rounds to 2 decimals.
**Bug severity if fails:** S1

### E22 — Discount field missing from iOS form (product gap)
**Priority:** P2
**Steps:** Inspect `InvoiceFormView.swift` line-item row.
**Expected result:** Discount-percent field is rendered. **Current state:** no discount field in the form (grep confirms no "discount" match in InvoiceFormView.swift). Log as product gap.
**Bug severity if fails:** S3 (product gap)

### E23 — Mixed-tax line items (5% + 18% in same invoice)
**Priority:** P1
**Steps:** 2 lines: (qty 1, rate 1000, 5%), (qty 1, rate 500, 18%).
**Expected result:** totalCgst = 25 + 45 = 70; totalSgst same; grand_total 1640.
**Bug severity if fails:** S1

### E24 — Rounding: 3 lines × 33.33 @ 18%
**Priority:** P0
**Steps:** qty 1, rate 33.33, tax 18%; three such lines.
**Expected result:** Each taxable 33.33, tax 6.00 (round half-up at 2dp) per backend `round(taxable * rate/100, 2)`; subtotal 99.99; cgst 9.00; sgst 9.00; grand_total 117.99. Verify no ₹0.01 rounding surprises.
**Bug severity if fails:** S1

### E25 — Very large invoice: grand_total > ₹10,00,000
**Priority:** P1
**Steps:** qty 1000, rate 1500, tax 18%.
**Expected result:** grand_total 17,70,000. Indian-digit grouping `17,70,000.00` on PDF. No overflow / scientific notation in UI.
**Bug severity if fails:** S2

### E26 — Negative or zero quantity rejected
**Priority:** P1
**Steps:** qty 0, try save. Then qty -1, try save.
**Expected result:** Validation error; no 201 from server; form retains input.
**Bug severity if fails:** S2

### E27 — Decimal quantity (2.5 units)
**Priority:** P2
**Steps:** qty 2.5, rate 400, tax 18%.
**Expected result:** taxable 1000, tax 180, total 1180.
**Bug severity if fails:** S3

### E28 — Grand total "in words" in API response
**Priority:** P1
**Steps:** Create ₹12,345 invoice; fetch via `GET /api/invoices/{id}`.
**Expected result:** Response contains `amount_in_words` like "Twelve Thousand Three Hundred Forty Five Rupees Only" (per `amount_to_words_inr` at L11860+). NB: this field is NOT rendered on the PDF (see Advisory A2). Acceptance is API-level only.
**Bug severity if fails:** S3

### E29 — HSN/SAC code persists on line item
**Priority:** P2
**Steps:** Enter HSN "9983" on a line → save → reopen.
**Expected result:** Round-trips. Shows on PDF next to description.
**Bug severity if fails:** S3

---

## Section 3 — Invoice PDF Generation & Preview

### E30 — PDF preview loads real bytes, not JSON
**Priority:** P0
**Pre-conditions:** Saved invoice.
**Steps:** Tap invoice row → preview opens.
**Expected result:** Network call `GET /api/invoices/{id}/pdf` responds with `Content-Type: application/pdf`, binary body. `PDFKitView` renders first page within 2s.
**Bug severity if fails:** S1 (would re-open 6d2b291 regression)

### E31 — Loading state shown while PDF fetches
**Priority:** P2
**Steps:** Throttle network to Slow 3G, open preview.
**Expected result:** ProgressView with localized "loading_invoice_pdf" string visible; resolves to PDF when bytes arrive.
**Bug severity if fails:** S3

### E32 — PDF renders correct invoice number as title
**Priority:** P1
**Steps:** Open invoice INV-0042 preview.
**Expected result:** Navigation title shows "INV-0042". PDF body title bar reads "TAX INVOICE" (if GST) or "INVOICE" (if simple).
**Bug severity if fails:** S3

### E33 — PDF contains firm block from user settings
**Priority:** P1
**Pre-conditions:** Settings filled: firm_name, firm_address, firm_city, firm_state, firm_pincode, firm_gstin, firm_phone, firm_email, bank details.
**Steps:** Generate PDF.
**Expected result:** Firm block visible at top with all fields joined with commas and pipe separators.
**Bug severity if fails:** S2

### E34 — PDF omits empty firm fields gracefully
**Priority:** P2
**Pre-conditions:** Only firm_name set.
**Steps:** Generate PDF.
**Expected result:** Only firm_name line shown; no dangling commas; no empty "GSTIN:" label.
**Bug severity if fails:** S3

### E35 — PDF rupee rendering uses "Rs." prefix
**Priority:** P1
**Steps:** Inspect PDF total cell.
**Expected result:** Reads `Rs. 1,180.00` (not `₹1,180.00`). This is intentional per `safe()` in generator. Catches regressions where `₹` leaks into latin-1 encode and becomes `?`.
**Bug severity if fails:** S2

### E36 — Indian digit grouping on PDF
**Priority:** P1
**Steps:** Create invoice grand_total 1234567.89; generate PDF.
**Expected result:** Renders `Rs. 12,34,567.89` (Indian lakh grouping), not `Rs. 1,234,567.89`.
**Bug severity if fails:** S2

### E37 — Hindi / Devanagari customer name renders as `?` (known defect)
**Priority:** P1
**Pre-conditions:** Customer name = `राम कुमार`.
**Steps:** Generate PDF.
**Expected result:** Under current code Devanagari chars become `?`. File the bug against the font choice. Fix requires `pdf.add_font("DejaVuSans", "", "DejaVuSans.ttf", uni=True)` and switching encoding.
**Bug severity if fails:** S2 (content loss in a shipping doc)

### E38 — Emoji in notes renders as `?` (latin-1 replace)
**Priority:** P3
**Steps:** Add note "Thanks 🙏" → generate PDF.
**Expected result:** Emoji replaced; base ASCII preserved. Document as known limitation.
**Bug severity if fails:** S4

### E39 — Logo is NOT embedded in PDF (product gap)
**Priority:** P2
**Pre-conditions:** firm_logo_url set in settings.
**Steps:** Generate PDF; search for image on the rendering.
**Expected result:** No logo. There is no `pdf.image()` call in `_generate_invoice_pdf_bytes`. Log as product gap.
**Bug severity if fails:** S3 (product gap)

### E40 — 50-line-item PDF performance
**Priority:** P1
**Steps:** Create invoice with 50 line items; open preview.
**Expected result:** PDF generation < 3s on Railway hobby tier; preview loads < 5s end-to-end; pages paginate (A4 auto_page_break margin 15mm).
**Bug severity if fails:** S2

### E41 — 100-line-item multi-page PDF
**Priority:** P2
**Steps:** 100 line items.
**Expected result:** Multi-page PDF (2+ pages); totals appear on last page; no overflow of rows past page margin.
**Bug severity if fails:** S3

### E42 — Print via AirPrint
**Priority:** P1
**Pre-conditions:** Wi-Fi reachable AirPrint printer (or Mac Printer Simulator).
**Steps:** Preview → printer icon → choose printer → Print.
**Expected result:** `UIPrintInteractionController` presents; job lands in print queue with name = invoice number; output page matches preview.
**Bug severity if fails:** S2

### E43 — Print-without-printer fallback (PDF destination)
**Priority:** P2
**Steps:** Print sheet → pinch to enter PDF preview.
**Expected result:** iOS standard PDF export works; file has correct name and content.
**Bug severity if fails:** S3

### E44 — Share via WhatsApp attaches PDF, not URL
**Priority:** P0
**Steps:** Preview → share icon → WhatsApp.
**Expected result:** `UIActivityViewController` receives `pdfData` (Data). WhatsApp recipient picker opens; sending produces a PDF attachment, filename `invoice_<number>.pdf`. (Note: WhatsApp preserves the filename when sharing Data.)
**Bug severity if fails:** S2

### E45 — Share via Mail attaches PDF with filename
**Priority:** P1
**Steps:** Share → Mail.
**Expected result:** Compose opens with PDF attached, filename `invoice_<number>.pdf`, MIME `application/pdf`.
**Bug severity if fails:** S3

### E46 — Share via Messages (iMessage) attaches PDF
**Priority:** P2
**Steps:** Share → Messages.
**Expected result:** iMessage opens with PDF attached.
**Bug severity if fails:** S3

### E47 — Save to Files
**Priority:** P1
**Steps:** Share → Save to Files → iCloud Drive → SpentyAI folder → Save.
**Expected result:** PDF persisted at selected location, filename `invoice_<number>.pdf`, opens correctly in Files.
**Bug severity if fails:** S3

### E48 — Save to Photos is blocked (PDFs are not images)
**Priority:** P3
**Steps:** Share → look for "Save Image".
**Expected result:** Option absent / disabled (PDF is not UIImage). Acceptable behaviour.
**Bug severity if fails:** S4

### E49 — Share sheet dismiss without action
**Priority:** P2
**Steps:** Share → Cancel.
**Expected result:** Sheet dismisses cleanly; no crash; preview still visible.
**Bug severity if fails:** S3

### E50 — Retry on PDF fetch failure
**Priority:** P1
**Pre-conditions:** Kill backend or disable Wi-Fi after tapping preview.
**Steps:** Tap Retry button in error view.
**Expected result:** `loadPDF()` re-runs; success after connectivity restored; error view clears.
**Bug severity if fails:** S3

### E51 — PDF cache is not stale after invoice edit
**Priority:** P1
**Pre-conditions:** Viewed PDF of INV-0010, then edited rate.
**Steps:** Reopen preview.
**Expected result:** New PDF fetched (no HTTP cache hit with stale data); revised total visible.
**Bug severity if fails:** S2

---

## Section 4 — Record Payment

### E52 — Record full payment marks invoice paid
**Priority:** P0
**Pre-conditions:** Unpaid invoice, grand_total 1180.
**Steps:** Invoice detail → Record Payment → amount 1180, method UPI, account "ICICI", date today.
**Expected result:** `POST /api/invoices/{id}/record-payment` returns 200; paymentStatus `paid`; amountPaid 1180; payments array has one entry; a linked transaction is created (check Transactions tab). Account "ICICI" balance recalculated (ONLY approved — per user's pending-policy).
**Bug severity if fails:** S1

### E53 — Record partial payment sets status `partial`
**Priority:** P0
**Steps:** Record ₹500 of ₹1180.
**Expected result:** Status `partial`; amountPaid 500; one payment entry; one transaction for 500.
**Bug severity if fails:** S1

### E54 — Second partial payment updates existing transaction (not creates new)
**Priority:** P1
**Pre-conditions:** After E53.
**Steps:** Record another ₹300.
**Expected result:** Same `transaction_id`; transaction amount updated to 800 (see server.py L12561–12575); invoice `payments` array grows to 2; account balance correct.
**Bug severity if fails:** S1

### E55 — Final payment flips partial → paid
**Priority:** P0
**Pre-conditions:** After E54 (₹800 paid).
**Steps:** Record ₹380.
**Expected result:** Status `paid`; amountPaid 1180; linked transaction amount 1180.
**Bug severity if fails:** S1

### E56 — Overpayment clamped to grand_total (advance)
**Priority:** P1
**Pre-conditions:** Unpaid invoice 1180.
**Steps:** Record 2000.
**Expected result:** Per server logic `new_paid = grand_total` when `new_paid >= grand_total`. Status `paid`, amountPaid 1180. The extra 820 is silently dropped unless an "advance" mechanism is exposed. Log as product gap if advance is expected.
**Bug severity if fails:** S2

### E57 — Negative payment rejected
**Priority:** P1
**Steps:** Amount -100.
**Expected result:** Server returns 400 "Payment amount must be positive".
**Bug severity if fails:** S2

### E58 — Zero payment rejected
**Priority:** P1
**Steps:** Amount 0.
**Expected result:** 400 "Payment amount must be positive".
**Bug severity if fails:** S2

### E59 — Payment method: UPI
**Priority:** P1
**Steps:** Choose method UPI.
**Expected result:** Transaction record has `payment_method: "upi"`.
**Bug severity if fails:** S3

### E60 — Payment method: Bank transfer
**Priority:** P1
**Steps:** Choose Bank.
**Expected result:** Transaction payment_method = "bank".
**Bug severity if fails:** S3

### E61 — Payment method: Cheque
**Priority:** P1
**Steps:** Choose Cheque.
**Expected result:** payment_method = "cheque".
**Bug severity if fails:** S3

### E62 — Bounced cheque handling (product gap check)
**Priority:** P2
**Steps:** After recording a cheque payment, look for "mark bounced" action.
**Expected result:** If absent, log as product gap. Workaround: edit invoice or delete transaction.
**Bug severity if fails:** S3 (product gap)

### E63 — Advance payment before invoice (product gap)
**Priority:** P2
**Steps:** Try to record payment without an invoice (i.e., vendor deposit).
**Expected result:** No such flow. Log as product gap if expected.
**Bug severity if fails:** S3 (product gap)

### E64 — Linked transaction visible in Transactions tab as approved
**Priority:** P0
**Steps:** After recording payment, go to Transactions.
**Expected result:** Auto-posted transaction appears as `approved` (not `pending_review`) so it feeds Dashboard / Cashflow immediately per user policy.
**Bug severity if fails:** S1

### E65 — Mark-as-Paid shortcut creates full-payment transaction
**Priority:** P1
**Pre-conditions:** Unpaid invoice.
**Steps:** Detail → Mark as Paid (no form).
**Expected result:** `POST /api/invoices/{id}/mark-paid` sets status paid, amountPaid = grand_total, creates transaction.
**Bug severity if fails:** S2

### E66 — Mark-as-Paid blocked when already paid
**Priority:** P2
**Steps:** Tap Mark as Paid on already-paid invoice.
**Expected result:** 400 "Invoice already paid" OR UI hides the button (InvoicePreviewView hides it when paymentStatus == "paid", line 145).
**Bug severity if fails:** S3

---

## Section 5 — Invoice Status Lifecycle

### E67 — New invoice defaults to `unpaid`
**Priority:** P1
**Steps:** Create invoice.
**Expected result:** paymentStatus = "unpaid". (App has no explicit `draft` vs `sent` split; that's a product gap if PM expected it.)
**Bug severity if fails:** S3

### E68 — Overdue derivation
**Priority:** P1
**Pre-conditions:** Unpaid invoice with due_date = yesterday.
**Steps:** Open list; apply Overdue filter.
**Expected result:** Invoice appears in Overdue. Matches `GET /api/invoices/aging` bucket.
**Bug severity if fails:** S2

### E69 — Read-only-after-paid (product gap check)
**Priority:** P2
**Pre-conditions:** Paid invoice.
**Steps:** Tap Edit.
**Expected result:** Either edit is blocked OR edit is allowed and updates grand_total correctly. Current code allows edit — confirm that edit of paid invoice doesn't desync the linked transaction amount. If it does, escalate.
**Bug severity if fails:** S2

### E70 — Paid invoice cannot record more payments
**Priority:** P1
**Pre-conditions:** Paid invoice.
**Steps:** Detail → look for Record Payment.
**Expected result:** Button hidden (confirmed: InvoicePreviewView line 145 gate).
**Bug severity if fails:** S3

---

## Section 6 — Customers CRUD & Validation

### E71 — Create customer with name only
**Priority:** P0
**Steps:** Customers → + → name "Acme Corp" → Save.
**Expected result:** 201; row in list.
**Bug severity if fails:** S2

### E72 — GSTIN format validation (15 chars, alpha-num pattern)
**Priority:** P1
**Steps:** Enter gstin "29ABCDE1234F1Z5" (valid). Then "29ABCDE" (invalid).
**Expected result:** Valid saves. Invalid rejected or flagged. Confirm iOS form does basic length check; backend stores as-is.
**Bug severity if fails:** S2

### E73 — Email format validation
**Priority:** P1
**Steps:** Enter "not-an-email".
**Expected result:** Validation blocks save or flags field red.
**Bug severity if fails:** S3

### E74 — Phone number: +91 country code and 10-digit
**Priority:** P1
**Steps:** Enter "+919876543210", then "9876543210", then "abc".
**Expected result:** First two accepted; third rejected or flagged.
**Bug severity if fails:** S3

### E75 — Duplicate customer detection (same name+gstin)
**Priority:** P2
**Steps:** Create Acme Corp twice with same gstin.
**Expected result:** Warning "Customer already exists" OR the app permits it and logs bug.
**Bug severity if fails:** S3

### E76 — Edit customer updates downstream invoice display
**Priority:** P1
**Pre-conditions:** Invoice references customer A.
**Steps:** Rename customer A to "Acme Pvt Ltd".
**Expected result:** Existing invoice's `customerName` on detail view updates (if stored by ref) OR stays (if denormalized). Verify behaviour matches schema. Document what's expected.
**Bug severity if fails:** S3

### E77 — Delete customer with existing invoices
**Priority:** P1
**Pre-conditions:** Customer has 1 invoice.
**Steps:** Delete customer.
**Expected result:** Either blocked with "Customer has invoices — cannot delete" OR soft-delete that preserves invoice history. No dangling ref.
**Bug severity if fails:** S1

### E78 — Customer detail shows invoice list for that customer
**Priority:** P1
**Steps:** Tap customer → view detail.
**Expected result:** List from `GET /api/customers/{id}/invoices`; totals (invoiced/paid/outstanding) match.
**Bug severity if fails:** S2

### E79 — Customer outstanding excludes pending-review transactions
**Priority:** P0
**Pre-conditions:** Customer with mixed approved and pending-review payments.
**Steps:** View outstanding total.
**Expected result:** Calculation uses only approved transactions — per user policy.
**Bug severity if fails:** S1

### E80 — Search customers by name
**Priority:** P2
**Steps:** Type partial name.
**Expected result:** Live filter.
**Bug severity if fails:** S3

### E81 — Billing vs Shipping address both saved
**Priority:** P2
**Steps:** Fill both; save; re-open.
**Expected result:** Both round-trip.
**Bug severity if fails:** S3

---

## Section 7 — Bills (Purchases) CRUD & Vendor Side

### E82 — Create bill manually with required fields
**Priority:** P0
**Steps:** Bills → + → vendor, bill_date, 1 line item, save.
**Expected result:** 201; appears in list.
**Bug severity if fails:** S1

### E83 — Bill number auto-suggest from `/api/bills/next-number`
**Priority:** P1
**Steps:** Open form.
**Expected result:** Pre-filled.
**Bug severity if fails:** S2

### E84 — Bill GST intra-state split matches invoice rules
**Priority:** P0
**Steps:** vendor state == firm state; 18%.
**Expected result:** CGST/SGST 9/9; IGST 0. Mirrors E18.
**Bug severity if fails:** S1

### E85 — Bill GST inter-state uses IGST
**Priority:** P0
**Steps:** vendor state != firm state; 18%.
**Expected result:** IGST 180; CGST/SGST 0.
**Bug severity if fails:** S1

### E86 — Record bill payment (full)
**Priority:** P0
**Steps:** Bill detail → Record Payment → full amount.
**Expected result:** paymentStatus "paid"; linked OUTFLOW transaction posted.
**Bug severity if fails:** S1

### E87 — Record bill payment (partial)
**Priority:** P0
**Steps:** 50% payment.
**Expected result:** Status "partial"; transaction for 50%.
**Bug severity if fails:** S1

### E88 — Bill duplicate action
**Priority:** P1
**Steps:** Detail → Duplicate.
**Expected result:** New bill with fresh ID, new number, today's date.
**Bug severity if fails:** S2

### E89 — Delete bill with payment (cascade check)
**Priority:** P1
**Steps:** Delete paid bill.
**Expected result:** Blocked OR cascades transaction delete + account recalc.
**Bug severity if fails:** S1

### E90 — Bill stats card accuracy
**Priority:** P1
**Steps:** View stats.
**Expected result:** Totals match `GET /api/bills/stats`.
**Bug severity if fails:** S2

### E91 — Creditors report matches `GET /api/bills/creditors`
**Priority:** P1
**Steps:** Navigate to creditors view.
**Expected result:** Vendor names, outstanding amounts, bill counts match API.
**Bug severity if fails:** S2

### E92 — Aging buckets (0-30, 31-60, 61-90, 90+)
**Priority:** P1
**Steps:** Seed bills with varying due dates; view aging.
**Expected result:** Bucket labels and amounts match API.
**Bug severity if fails:** S2

### E93 — Bill PDF renders with "BILL" title
**Priority:** P1
**Steps:** Open bill preview.
**Expected result:** Title bar reads "BILL" (or "TAX INVOICE" if bill_type == "gst" per server L12669).
**Bug severity if fails:** S3

### E94 — Bill PDF same format as invoice (shared generator)
**Priority:** P1
**Steps:** Generate bill PDF; visually compare to invoice PDF.
**Expected result:** Same A4 layout, same firm/counterparty blocks, same totals table.
**Bug severity if fails:** S3

### E95 — Bill PDF share via WhatsApp
**Priority:** P2
**Steps:** Share → WhatsApp.
**Expected result:** PDF attachment `bill_<number>.pdf`.
**Bug severity if fails:** S3

---

## Section 8 — Bill Upload Parser (AI)

### E96 — Upload clear PDF bill extracts structured data
**Priority:** P0
**Pre-conditions:** A known-good vendor invoice PDF (file < 10MB).
**Steps:** Bills → Upload → Choose PDF → wait for parse.
**Expected result:** `POST /api/bills/parse-upload` returns JSON with vendor_name, bill_date, line_items (desc/qty/rate/tax_rate), subtotal, tax_total, grand_total. Form pre-fills with parsed values. Requires `gpt-4o-mini` configured.
**Bug severity if fails:** S1

### E97 — Upload photograph of paper bill (OCR via vision model)
**Priority:** P0
**Steps:** Snap a bill photo in-app → upload.
**Expected result:** Structured JSON returned; 80%+ fields populated for a clear photo.
**Bug severity if fails:** S2

### E98 — Upload oversized file rejected
**Priority:** P1
**Pre-conditions:** File > 10MB.
**Steps:** Upload.
**Expected result:** 400 "File too large (max 10 MB)".
**Bug severity if fails:** S2

### E99 — Upload unsupported MIME (e.g., .docx)
**Priority:** P2
**Steps:** Try .docx.
**Expected result:** Either client-side gate or graceful server error; no crash.
**Bug severity if fails:** S3

### E100 — Upload when AI not configured
**Priority:** P1
**Pre-conditions:** `async_openai_client` None (simulate via env).
**Steps:** Upload.
**Expected result:** 500 "AI service not configured". iOS shows friendly error.
**Bug severity if fails:** S2

### E101 — Parsed vendor not in vendor list — user can pick existing or create new
**Priority:** P1
**Pre-conditions:** Parsed vendor_name "Unknown Traders" doesn't exist.
**Steps:** Accept draft → save.
**Expected result:** Either auto-creates vendor or prompts to map to existing. No orphan bill without vendor_id.
**Bug severity if fails:** S2

### E102 — AI returns JSON with code fences (` ```json `)
**Priority:** P2
**Steps:** Backend receives model output wrapped in fences.
**Expected result:** `raw_text[:-3]` stripping works (server.py L11632); JSON parses.
**Bug severity if fails:** S2

### E103 — Parser handles bill_type "gst" vs "simple"
**Priority:** P1
**Steps:** Upload a non-GST cash memo.
**Expected result:** `bill_type: "simple"`; no GST lines rendered.
**Bug severity if fails:** S3

### E104 — Confidence / user review step
**Priority:** P2
**Steps:** After parse, check UX.
**Expected result:** Parsed fields shown as editable before save. User can correct anything.
**Bug severity if fails:** S3

### E105 — Upload of blurry/unreadable bill
**Priority:** P2
**Steps:** Heavily blurred photo.
**Expected result:** Model returns nulls; UI shows "Could not parse, please enter manually" with prefilled empty form.
**Bug severity if fails:** S3

---

## Section 9 — Vendors CRUD

### E106 — Create vendor
**Priority:** P0
**Steps:** Vendors → + → name, gstin.
**Expected result:** 201.
**Bug severity if fails:** S2

### E107 — Vendor GSTIN validation
**Priority:** P1
**Steps:** Enter valid and invalid GSTIN.
**Expected result:** Same behaviour as E72.
**Bug severity if fails:** S3

### E108 — Edit vendor reflects in existing bills
**Priority:** P2
**Steps:** Rename vendor.
**Expected result:** Document denormalized vs ref behaviour.
**Bug severity if fails:** S3

### E109 — Delete vendor with bills — cascade or block
**Priority:** P1
**Steps:** Delete vendor that has ≥1 bill.
**Expected result:** Blocked or cascades safely.
**Bug severity if fails:** S1

### E110 — Vendor detail shows bills list
**Priority:** P1
**Steps:** Open vendor detail.
**Expected result:** Bills list via `GET /api/vendors/{id}/bills`; totals match.
**Bug severity if fails:** S2

### E111 — Vendor search
**Priority:** P2
**Steps:** Filter by name.
**Expected result:** Instant filter.
**Bug severity if fails:** S3

---

## Section 10 — Support Tickets

### E112 — Submit support ticket with subject/category/priority/message
**Priority:** P0
**Steps:** Support → fill form → Submit.
**Expected result:** `POST /api/support/ticket` 200; success alert "Ticket Submitted"; email fired to SUPPORT_EMAIL if RESEND_API_KEY set.
**Bug severity if fails:** S2

### E113 — Empty subject blocked
**Priority:** P1
**Steps:** Submit with empty subject.
**Expected result:** 400 "Subject is required".
**Bug severity if fails:** S2

### E114 — Empty message blocked
**Priority:** P1
**Steps:** Submit with empty message.
**Expected result:** 400 "Message is required".
**Bug severity if fails:** S2

### E115 — Category options include billing, bug, feature, account, data, general
**Priority:** P2
**Steps:** Open category picker.
**Expected result:** All six options present and match backend labels.
**Bug severity if fails:** S3

### E116 — Priority options: low / medium / high
**Priority:** P2
**Steps:** Open priority picker.
**Expected result:** Three options; default medium.
**Bug severity if fails:** S3

### E117 — Screenshot attachment (product gap)
**Priority:** P2
**Steps:** Look for attach-image button.
**Expected result:** Not implemented (`SupportTicket` model has no attachment field; `/api/support/ticket` doesn't accept files). Log as product gap.
**Bug severity if fails:** S3 (product gap)

### E118 — View ticket status (product gap)
**Priority:** P2
**Steps:** Look for "My Tickets".
**Expected result:** Not implemented — no `GET /api/support/tickets/mine`. Log as product gap.
**Bug severity if fails:** S3 (product gap)

### E119 — Reply to ticket / close ticket (product gap)
**Priority:** P2
**Steps:** Look for reply/close UI.
**Expected result:** Not implemented. Log as product gap.
**Bug severity if fails:** S3 (product gap)

### E120 — FAQ loads from `/api/support/faq`
**Priority:** P1
**Steps:** Support screen → FAQ section.
**Expected result:** FAQs render; tap expands answer.
**Bug severity if fails:** S3

### E121 — FAQ question expand / collapse animation
**Priority:** P3
**Steps:** Tap question twice.
**Expected result:** Smooth expand/collapse; `expandedFAQ` state tracks it.
**Bug severity if fails:** S4

---

## Section 11 — Feature Requests

### E122 — Submit feature request
**Priority:** P1
**Steps:** Feature Requests → + → title, description, category → Submit.
**Expected result:** `POST /api/feature-requests` 201; appears in list with 1 vote (submitter) or 0 depending on logic.
**Bug severity if fails:** S2

### E123 — List feature requests
**Priority:** P1
**Steps:** Open tab.
**Expected result:** `GET /api/feature-requests` list; sorted by votes desc by default.
**Bug severity if fails:** S3

### E124 — Upvote a request
**Priority:** P1
**Steps:** Tap vote button.
**Expected result:** `POST /api/feature-requests/{id}/vote` increments count; UI reflects new votes.
**Bug severity if fails:** S3

### E125 — Upvote idempotency (no double-vote)
**Priority:** P1
**Steps:** Tap vote twice quickly.
**Expected result:** Either idempotent (one +1) or second tap returns "already voted". Vote count does not double.
**Bug severity if fails:** S2

### E126 — Category filter (UI / Performance / Feature / Integration / Other)
**Priority:** P2
**Steps:** Filter by each.
**Expected result:** Matches `FeatureRequestCategory` enum values.
**Bug severity if fails:** S3

### E127 — Status badge (submitted / in_progress / completed)
**Priority:** P2
**Steps:** Seed items with various statuses.
**Expected result:** Badge color/label reflects `FeatureRequestStatus`.
**Bug severity if fails:** S3

---

## Section 12 — Billing Plans & Subscription (StoreKit)

### E128 — Current plan + usage banner renders
**Priority:** P0
**Pre-conditions:** Active monthly subscription.
**Steps:** Settings → Billing (or tab).
**Expected result:** Shows plan name (Monthly), price (₹199/month), status active, expiresAt date. Pulled from `GET /api/payments/status` → `SubscriptionStatus`.
**Bug severity if fails:** S2

### E129 — StoreKit products load from App Store
**Priority:** P0
**Pre-conditions:** Test device signed into sandbox Apple ID.
**Steps:** Open Billing view.
**Expected result:** `Product.products(for:)` returns `com.spentyai.monthly`, `.quarterly`, `.yearly`, `.lifetime`. Localized prices (INR) displayed.
**Bug severity if fails:** S1

### E130 — Fallback plans shown if StoreKit fails
**Priority:** P1
**Pre-conditions:** Force `Product.products(for:)` to return empty.
**Steps:** Open Billing view.
**Expected result:** `Self.fallbackPlans` rendered with hard-coded ₹199/₹449/₹1,499/₹4,999 prices.
**Bug severity if fails:** S2

### E131 — Purchase monthly plan (sandbox)
**Priority:** P0
**Steps:** Tap Monthly → Subscribe → auth with sandbox Apple ID.
**Expected result:** StoreKit returns transaction; app calls `/api/payments/apple/verify` with receiptData + productId; response sets plan; UI reflects Monthly.
**Bug severity if fails:** S1

### E132 — Upgrade monthly → yearly mid-cycle
**Priority:** P1
**Pre-conditions:** Active monthly.
**Steps:** Tap Yearly → Subscribe.
**Expected result:** Apple prompts to upgrade with prorated credit; backend verifies new receipt; subscription switches.
**Bug severity if fails:** S2

### E133 — Downgrade yearly → monthly takes effect at renewal
**Priority:** P1
**Pre-conditions:** Active yearly.
**Steps:** Tap Monthly → confirm.
**Expected result:** Apple schedules change at next renewal; UI shows "Changes at renewal".
**Bug severity if fails:** S3

### E134 — Cancel subscription deep-links to App Store Subscriptions
**Priority:** P0
**Steps:** Billing → Cancel Subscription → confirm.
**Expected result:** Either opens `https://apps.apple.com/account/subscriptions` via `UIApplication.open` OR calls `/api/payments/cancel`. Verify which flow (code shows both `BillingEndpoints.cancel` exists AND StoreKit is imported). Confirm iOS opens the subscriptions page so Apple's rule is satisfied.
**Bug severity if fails:** S1 (App Store rule)

### E135 — Receipt download after purchase
**Priority:** P2
**Steps:** Purchase history → tap order → download.
**Expected result:** `GET /api/payments/history` lists orders; download/email option available. If absent, log gap.
**Bug severity if fails:** S3

### E136 — Payment method change
**Priority:** P2
**Steps:** Change card.
**Expected result:** For StoreKit, user must go through Apple ID settings (deep-link present). App cannot store card. Confirm deep-link works.
**Bug severity if fails:** S3

### E137 — Past-due state
**Priority:** P1
**Pre-conditions:** Simulate via DB: set subscription expiry yesterday, provider "apple", autoRenew true but renewal failed.
**Steps:** Open Billing.
**Expected result:** Banner "Subscription past due — update payment method in App Store". Core features gated or grace-period messaging per product spec.
**Bug severity if fails:** S2

### E138 — Free trial shows days remaining
**Priority:** P1
**Pre-conditions:** New user in 7-day trial.
**Steps:** Open Billing.
**Expected result:** "Trial: X days left" banner.
**Bug severity if fails:** S3

### E139 — Promo / lifetime plan
**Priority:** P2
**Pre-conditions:** User granted lifetime via promo.
**Steps:** Open Billing.
**Expected result:** provider "promo" or "apple" with productId lifetime; no renewal date; no cancel CTA.
**Bug severity if fails:** S3

### E140 — Purchase history list matches `/api/payments/history`
**Priority:** P1
**Steps:** Billing → View History.
**Expected result:** `PaymentHistoryView` shows orders with status badges (success/failed/**refunded** — color orange per L98).
**Bug severity if fails:** S3

### E141 — Restore purchases
**Priority:** P0
**Pre-conditions:** Logged into new install with same Apple ID as previous purchaser.
**Steps:** Tap Restore Purchases.
**Expected result:** StoreKit returns transactions; backend verifies; subscription re-activated.
**Bug severity if fails:** S1 (App Store rule)

---

## Section 13 — Help Center

### E142 — Help Center reachable from in-app (product gap)
**Priority:** P1
**Steps:** Settings → look for Help / FAQs / Help Center link.
**Expected result:** In-app route to webview `https://spentyai.com/help`. **Current state: no such entry exists** (grep on Settings/ finds no matches). Log as product gap.
**Bug severity if fails:** S2

### E143 — Web Help Center `/help` loads with 32 articles × 108 screenshots
**Priority:** P1
**Steps:** Open `https://spentyai.com/help` in Safari.
**Expected result:** Renders with side-by-side mobile + web screenshots. 32 articles listed. (Matches memory "help_center_screenshots_handoff".)
**Bug severity if fails:** S2

### E144 — HelpCenter article image path resolves
**Priority:** P1
**Steps:** Click any article.
**Expected result:** Images at `/help/<file>-en.png` load (`public/help/` folder). 404 fallback to `fallbackSrc` at HelpCenter.jsx L36.
**Bug severity if fails:** S2

### E145 — EN / HI language toggle
**Priority:** P1
**Steps:** Toggle language.
**Expected result:** Articles show `-hi.png` variants when HI selected; text localizes.
**Bug severity if fails:** S2

### E146 — Mobile + Web suffix variants
**Priority:** P2
**Steps:** Inspect same article's mobile and web image variants.
**Expected result:** `<file>-mobile-<lang>.png` and `<file>-web-<lang>.png` variants exist per HelpCenter.jsx suffix logic.
**Bug severity if fails:** S3

### E147 — Help Center search
**Priority:** P2
**Steps:** Type keyword.
**Expected result:** Filters article list; no matches shows empty state.
**Bug severity if fails:** S3

### E148 — Article "Was this helpful?" feedback
**Priority:** P3
**Steps:** Tap yes/no at article bottom.
**Expected result:** If implemented, logs to analytics; thank-you confirmation shown. If absent, log gap.
**Bug severity if fails:** S4

### E149 — Sign-in article is NOT present (destructive — per memory)
**Priority:** P3
**Steps:** Search "sign in".
**Expected result:** Sign-in article intentionally missing (destructive). Matches memory.
**Bug severity if fails:** S4

---

## Section 14 — Refund Policy

### E150 — Refund policy reachable from in-app Settings (product gap)
**Priority:** P1
**Steps:** Settings → Legal → Refund.
**Expected result:** Link to `https://spentyai.com/refund-policy`. **Current state: no such entry** (grep confirms). Log as product gap — blocks App Store rejection risk if policy is not discoverable in-app for subscriptions.
**Bug severity if fails:** S2 (App Store risk)

### E151 — Refund policy reachable from Landing footer (web)
**Priority:** P1
**Pre-conditions:** Fresh browser session.
**Steps:** Visit `https://spentyai.com` → scroll to footer.
**Expected result:** "Refund Policy" link (Landing.jsx L254) visible and navigates to `/refund-policy`.
**Bug severity if fails:** S2

### E152 — `/refund-policy` page loads
**Priority:** P1
**Steps:** Visit route.
**Expected result:** `RefundPolicy.jsx` renders 199 lines of policy content.
**Bug severity if fails:** S2

### E153 — Contact email link on refund page
**Priority:** P2
**Steps:** Locate contact email.
**Expected result:** `mailto:` link to SUPPORT_EMAIL; opens mail client.
**Bug severity if fails:** S3

---

## Section 15 — Privacy / Terms / Legal Links

### E154 — LoginView links to Terms
**Priority:** P1
**Steps:** On sign-in screen, tap Terms.
**Expected result:** Opens `https://spentyai.com/terms` in Safari.
**Bug severity if fails:** S2

### E155 — LoginView links to Privacy
**Priority:** P1
**Steps:** Tap Privacy.
**Expected result:** Opens `https://spentyai.com/privacy`.
**Bug severity if fails:** S2

### E156 — Paywall links to Terms / Privacy
**Priority:** P1
**Steps:** On `SubscriptionPaywall`, tap Terms then Privacy.
**Expected result:** Both links open. Required for App Store sub rules.
**Bug severity if fails:** S1 (App Store rule)

### E157 — `/terms` page matches `public/terms.html`
**Priority:** P2
**Steps:** Compare fetched content.
**Expected result:** Current content shown; last-updated date correct.
**Bug severity if fails:** S3

### E158 — `/privacy` matches `public/privacy.html`
**Priority:** P2
**Steps:** Compare.
**Expected result:** Current content.
**Bug severity if fails:** S3

### E159 — Settings → Legal section (product gap)
**Priority:** P1
**Steps:** Settings.
**Expected result:** No "Legal" or "About" section. Log gap — recommend adding Terms, Privacy, Refund, Licenses, App Version.
**Bug severity if fails:** S2 (App Store + trust)

---

## Section 16 — Localization (EN / HI / Hinglish)

### E160 — All invoice form labels localize in HI
**Priority:** P1
**Steps:** Settings → Language → Hindi → open invoice form.
**Expected result:** Labels "Invoice Number", "Customer", "Date", "Line Items", "Save" all render Hindi strings from `lang.s(...)`.
**Bug severity if fails:** S3

### E161 — Hinglish strings render Roman-script Hindi
**Priority:** P2
**Steps:** Switch to Hinglish.
**Expected result:** e.g. "Kitna amount" instead of "कितनी राशि". Per feedback_ai_no_assume_category and user comms style.
**Bug severity if fails:** S3

### E162 — Preview PDF title string localization is moot (latin-1 constraint)
**Priority:** P1
**Steps:** In HI, open preview.
**Expected result:** PDF title is hard-coded "TAX INVOICE" / "INVOICE" / "BILL" (server.py). NOT localized — expected given current generator. iOS nav title uses invoice number, not a label.
**Bug severity if fails:** S4 (known-by-design)

### E163 — Number formatter for INR across locales
**Priority:** P1
**Steps:** Switch locale to HI; view grand total.
**Expected result:** iOS uses `NumberFormatter` with `currencySymbol = "\u{20B9}"`. `₹1,180.00` or `₹1,180`. Verify Indian grouping behaviour in iOS (NumberFormatter uses en_IN by default when Indian locale active).
**Bug severity if fails:** S3

---

## Section 17 — Dark Mode / Appearance

### E164 — Invoice list readable in dark mode
**Priority:** P1
**Steps:** Toggle system dark mode.
**Expected result:** `Color.spentyBgPrimary`, `spentyTextPrimary` adapt; list has sufficient contrast.
**Bug severity if fails:** S3

### E165 — PDF preview background in dark mode
**Priority:** P2
**Steps:** Open preview in dark mode.
**Expected result:** `PDFView.backgroundColor = UIColor(Color.spentyBgPrimary)` (dark); PDF content is white-paper, readable.
**Bug severity if fails:** S3

### E166 — Billing cards / gradient in dark mode
**Priority:** P2
**Steps:** Open Billing in dark.
**Expected result:** No white-on-white; all gradients visible.
**Bug severity if fails:** S3

---

## Section 18 — Accessibility

### E167 — VoiceOver on invoice list
**Priority:** P1
**Steps:** VoiceOver on → navigate list.
**Expected result:** Each row reads "invoice number, customer, amount, status". No unlabeled buttons.
**Bug severity if fails:** S2

### E168 — VoiceOver on invoice form fields
**Priority:** P1
**Steps:** VO through fields.
**Expected result:** Labels announced; decimal-pad fields announce "decimal keyboard".
**Bug severity if fails:** S2

### E169 — VoiceOver on share and print buttons
**Priority:** P1
**Steps:** VO to toolbar icons.
**Expected result:** Accessible labels e.g., "Share invoice", "Print invoice". Currently using SF Symbols without explicit `.accessibilityLabel` — likely failure, log bug.
**Bug severity if fails:** S2

### E170 — Dynamic Type XXL
**Priority:** P1
**Steps:** Settings → Larger Text → XXL.
**Expected result:** All text scales; no clipped labels on list rows or form rows; totals area doesn't push actions off-screen.
**Bug severity if fails:** S3

### E171 — Dynamic Type AX5 (largest accessibility size)
**Priority:** P2
**Steps:** AX5.
**Expected result:** Content reflows; horizontal HStacks may wrap. Flag any truncations.
**Bug severity if fails:** S3

### E172 — Color contrast on status chips (paid/unpaid/overdue)
**Priority:** P2
**Steps:** Inspect chips.
**Expected result:** ≥ 4.5:1 contrast against background. Overdue uses `spentyError`, paid uses `spentySuccess`.
**Bug severity if fails:** S3

---

## Section 19 — Offline & Error Handling

### E173 — Open invoice list while offline
**Priority:** P1
**Pre-conditions:** Airplane mode; previously loaded list cached.
**Steps:** Open app.
**Expected result:** Cached list shown OR clear offline banner. No crash, no blank screen.
**Bug severity if fails:** S2

### E174 — Attempt PDF fetch while offline
**Priority:** P1
**Steps:** Tap invoice while offline.
**Expected result:** Error view with retry. No crash.
**Bug severity if fails:** S2

### E175 — Save invoice while offline
**Priority:** P1
**Steps:** Create invoice offline, tap Save.
**Expected result:** Clear error "No connection"; form stays open; draft preserved in-memory.
**Bug severity if fails:** S2

### E176 — Record payment while offline
**Priority:** P1
**Steps:** Try.
**Expected result:** Error shown; no phantom state where UI shows paid but server doesn't know.
**Bug severity if fails:** S1

### E177 — 500 from backend
**Priority:** P1
**Pre-conditions:** Force backend 500.
**Steps:** Any write.
**Expected result:** Alert with server error message or friendly fallback.
**Bug severity if fails:** S3

### E178 — 401 triggers re-auth
**Priority:** P0
**Pre-conditions:** Expired token.
**Steps:** Trigger API call.
**Expected result:** Redirects to login; does not silently fail.
**Bug severity if fails:** S1

### E179 — Timeout handling
**Priority:** P2
**Pre-conditions:** Slow backend > 30s on PDF.
**Steps:** Open preview.
**Expected result:** Timeout error with retry.
**Bug severity if fails:** S3

---

## Section 20 — Performance & Scale

### E180 — 500-invoice list cold-start
**Priority:** P1
**Pre-conditions:** 500 invoices seeded.
**Steps:** Launch app → Invoices.
**Expected result:** First paint < 2s on iPhone 15 Pro; scroll 60fps.
**Bug severity if fails:** S3

### E181 — 500-item customers list scroll
**Priority:** P2
**Steps:** Scroll top to bottom.
**Expected result:** No dropped frames > 5; memory stable.
**Bug severity if fails:** S3

### E182 — Background → foreground state retention
**Priority:** P1
**Steps:** Open invoice preview → home button → wait 5 min → re-open.
**Expected result:** Preview still visible with cached PDF; no reload unless PDF is stale.
**Bug severity if fails:** S3

### E183 — Memory after generating 10 PDFs back-to-back
**Priority:** P2
**Steps:** Open and close 10 different invoice previews.
**Expected result:** Memory plateaus; `pdfData` from prior views released.
**Bug severity if fails:** S3

### E184 — CPU during PDF render
**Priority:** P3
**Steps:** Instrument.
**Expected result:** < 50% sustained CPU on iPhone 15 Pro.
**Bug severity if fails:** S4

---

## Section 21 — Cross-Cutting Regressions & Gotchas

### E185 — Transactions from invoice payments do NOT appear in pending_review
**Priority:** P0
**Steps:** Record payment → go to Transactions → check "Needs Review".
**Expected result:** Zero matches. Per user policy, only approved transactions affect calcs.
**Bug severity if fails:** S1

### E186 — Invoice deletion does not orphan a `pending_review` transaction
**Priority:** P0
**Steps:** Delete invoice.
**Expected result:** Linked approved transaction also deleted; no pending txn created accidentally.
**Bug severity if fails:** S1

### E187 — Duplicating an invoice does NOT duplicate the transaction
**Priority:** P1
**Steps:** Duplicate paid invoice.
**Expected result:** New invoice has no payments/transaction. Original transaction unchanged.
**Bug severity if fails:** S2

### E188 — Invoice edit that reduces grand_total below amount_paid
**Priority:** P0
**Pre-conditions:** Paid invoice ₹1180.
**Steps:** Edit → drop rate so grand_total becomes ₹500.
**Expected result:** Block OR prompt "Amount paid (1180) exceeds new total (500)". No silent overpayment state.
**Bug severity if fails:** S1

### E189 — Recording payment on a deleted invoice
**Priority:** P1
**Pre-conditions:** Another device deleted invoice while this device still has detail view open.
**Steps:** Tap Record Payment.
**Expected result:** 404 "Invoice not found"; friendly error; detail view dismisses.
**Bug severity if fails:** S2

### E190 — Firm-settings rupee symbol in PDF
**Priority:** P2
**Steps:** Set `firm_phone = "Call ₹99 now"` (silly input).
**Expected result:** `safe()` replaces ₹ with "Rs. " in the PDF — no crash.
**Bug severity if fails:** S3

### E191 — Billing view's `cancelSection` visible only if StoreKit-managed
**Priority:** P1
**Pre-conditions:** Promo subscription (provider="promo").
**Steps:** Open Billing.
**Expected result:** Cancel section hidden or disabled (user can't cancel via StoreKit for a promo). Confirm code gates on provider.
**Bug severity if fails:** S2

### E192 — Share sheet does not expose internal file paths
**Priority:** P2
**Steps:** Share PDF; inspect URL.
**Expected result:** Shared as Data or temp URL without leaking sandbox path. Currently passes `pdfData` (Data) — OK.
**Bug severity if fails:** S3

### E193 — Invoice with 0 line items rejected
**Priority:** P1
**Steps:** Remove all line items; save.
**Expected result:** `at_least_one_item` validation.
**Bug severity if fails:** S2

### E194 — Due date before invoice date
**Priority:** P2
**Steps:** Set due_date < invoice_date.
**Expected result:** Warning or block.
**Bug severity if fails:** S3

### E195 — Timezone: invoice saved at IST 11pm shows correct date in US viewing
**Priority:** P2
**Steps:** Save from IST device; inspect via US-timezone account/browser (if team account).
**Expected result:** Date field is date-only (no TZ confusion). Backend stores YYYY-MM-DD string.
**Bug severity if fails:** S3

### E196 — Customer with 10k-char billingAddress does not break PDF
**Priority:** P3
**Steps:** Very long address.
**Expected result:** PDF truncates or wraps without overflow; no crash.
**Bug severity if fails:** S4

### E197 — Same-user concurrent create of two invoices on two devices
**Priority:** P2
**Steps:** Trigger simultaneously.
**Expected result:** Both get unique `invoiceId`s; `invoiceNumber` sequencing stable (acceptable if one gets a retry due to uniqueness conflict).
**Bug severity if fails:** S2

### E198 — Log-out clears in-memory invoice/customer caches
**Priority:** P0
**Steps:** Sign out; sign in as different user.
**Expected result:** Old user's invoices not visible. ViewModel reset.
**Bug severity if fails:** S1 (privacy)

### E199 — Siri Shortcut / App Intent for "record a payment" (if shipped)
**Priority:** P3
**Steps:** Try Siri "record invoice payment".
**Expected result:** Intent exists in `SiriIntents/` directory — confirm if invoice-payment intent is registered and works.
**Bug severity if fails:** S4

### E200 — Widget / Home screen accessory surfaces outstanding total
**Priority:** P3
**Steps:** Add Home screen widget (if present).
**Expected result:** Total Outstanding number matches app. Out of scope if widget absent.
**Bug severity if fails:** S4

---

## Appendix A — Endpoints Reference (from `backend/server.py`)

| Method | Path | Line | Notes |
|---|---|---|---|
| GET  | `/api/invoices` | 12359 | list |
| POST | `/api/invoices` | 12290 | create |
| GET  | `/api/invoices/next-number` | 12383 | auto-num |
| GET  | `/api/invoices/stats` | 12391 | |
| GET  | `/api/invoices/count` | 12161 | |
| GET  | `/api/invoices/debtors` | 12167 | |
| GET  | `/api/invoices/aging` | 12192 | |
| GET  | `/api/invoices/sales-by-customer` | 12265 | |
| GET  | `/api/invoices/{id}` | 12437 | |
| PUT  | `/api/invoices/{id}` | 12447 | |
| DELETE | `/api/invoices/{id}` | 12496 | |
| POST | `/api/invoices/{id}/record-payment` | 12519 | auto-post txn |
| POST | `/api/invoices/{id}/mark-paid` | 12845 | |
| POST | `/api/invoices/{id}/duplicate` | 12886 | |
| GET  | `/api/invoices/{id}/pdf` | 12826 | **application/pdf** |
| POST | `/api/bills/parse-upload` | 11558 | AI OCR |
| GET/POST/... | `/api/bills/...` | 13086+ | parallel to invoices |
| GET  | `/api/bills/{id}/pdf` | 13508 | **application/pdf** |
| POST | `/api/customers` | 11896 | |
| GET  | `/api/customers/{id}/invoices` | 12015 | |
| POST | `/api/vendors` | 12918 | |
| GET  | `/api/vendors/{id}/bills` | 13013 | |
| POST | `/api/support/ticket` | 9517 | write-only |
| GET  | `/api/support/faq` | 9627 | |
| GET  | `/api/feature-requests` | 3530 | |
| POST | `/api/feature-requests` | 3538 | |
| POST | `/api/feature-requests/{id}/vote` | 3570 | |
| GET  | `/api/payments/plans` | 10705 | |
| GET  | `/api/payments/status` | 10841 | |
| POST | `/api/payments/apple/verify` | 10721 | |
| POST | `/api/payments/cancel` | 10857 | |
| GET  | `/api/payments/history` | 10689 | |

## Appendix B — Known product gaps flagged by this plan (raise PRs)
1. No in-app Settings → Help Center / Refund Policy / Legal entry points (A3, E142, E150, E159).
2. PDF generator uses latin-1 Helvetica; no Devanagari / Unicode support; `₹` replaced with `Rs.` (A2, E37).
3. PDF generator does not embed firm logo (E39).
4. `amount_in_words` not rendered on PDF (E28).
5. Invoice form does not expose `discount_percent` field (E22).
6. No bounced-cheque / advance-payment flow (E62, E63).
7. Support is write-only (no list/reply/close, no attachment) (A4, E117, E118, E119).
8. Overpayment silently clamped to grand_total (E56).

---

**End of Domain E test plan.**
