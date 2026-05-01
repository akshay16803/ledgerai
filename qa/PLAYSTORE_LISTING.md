# SpentyAI — Google Play Store Listing

## App title (max 30 chars)
1. SpentyAI: AI Accountant (23/30 chars)
2. SpentyAI: AI Books & GST (24/30 chars)
3. SpentyAI - Smart Expense AI (27/30 chars)

**Recommended:** #1 "SpentyAI: AI Accountant" — leads with the brand, then the single most differentiated claim ("AI Accountant"). Matches the iOS subtitle so brand language is consistent across stores. Short enough that it never truncates on small Android phones, where the title sits next to the icon and competes with the developer name.

---

## Short description (max 80 chars)
1. AI accountant for India. Track expenses, find auto-debits, make GST invoices. (77/80 chars)
2. Talk to your finances. AI logs expenses, finds auto-debits, makes GST bills. (76/80 chars)
3. AI bookkeeper for India: expenses, UPI, GST invoices, subscriptions tracker. (76/80 chars)

**Recommended:** #1 — leads with the value prop ("AI accountant"), anchors to the target market ("for India"), and lists three concrete jobs the user will recognise themselves doing. #2 is more brand-y and nicer to read but buries the India hook; #3 reads like a feature list and lacks a verb.

---

## Full description (max 4000 chars)

SpentyAI is the AI accountant in your pocket — built for India, fluent in UPI, GST, and the way real money moves. Track expenses, send GST invoices, find every auto-debit hiding in your inbox, and forecast the next 24 months of cash flow.

Try free for 7 days. Plans from Rs 199/month.

————————————————

TALK TO YOUR FINANCES — AI DOES THE BOOKS

Tell SpentyAI in plain English: "I spent Rs 500 on lunch from HDFC card." The AI records the entry, picks the right category, posts the double-entry journal, and queues it for one-tap approval. Ask "How much did I save this month?" and get an instant answer. No jargon. No spreadsheets. No CA fees for the small stuff.

————————————————

AUTO-DETECT TRANSACTIONS FROM YOUR INBOX

Connect Gmail or Outlook in one tap. SpentyAI reads only your transaction-related emails and drafts every entry — payments, salary credits, NEFT, RTGS, IMPS, UPI, EMIs, credit-card bills. You scan, you approve.

————————————————

NEVER MISS AN AUTO-DEBIT OR SUBSCRIPTION

SpentyAI finds every recurring charge buried in your email — NACH mandates, UPI AutoPay, SIPs, EMIs, insurance, OTT subscriptions (Netflix, Spotify, Hotstar), gym memberships. See what's getting charged next month and how much. Cancelling one Rs 500/month sub pays for SpentyAI for two years.

————————————————

AI RECONCILIATION WHEN BALANCES DON'T MATCH

Upload your bank statement (PDF, Excel, or CSV — even password-protected). SpentyAI compares every line against your ledger and surfaces every conflict: duplicates, missed entries, wrong amounts. Fix gaps in minutes, with a complete audit trail.

————————————————

LIVE DASHBOARD + 24-MONTH CASH FLOW

Net worth, income, expenses, pending approvals, and every account in one view — bank, credit card, cash, wallet, loan, investment, all with running balances. Watch the next two years play forward: detected mandates project month by month so you can plan around them.

————————————————

GST INVOICES IN SECONDS

Polished invoices with your business logo and full GST — CGST, SGST, IGST, HSN codes. Email to clients, track payment status, manage debtor aging.

Purchase bills + creditor aging on the buy side, with ITC-ready GST breakdowns.

————————————————

RECEIPT SCANNER + REPORTS

Snap a photo of any receipt. AI extracts merchant, amount, date, tax, and line items, stored alongside the transaction. Visual reports break down every rupee by category, account, and period. Export to CSV or PDF for your accountant.

————————————————

ONE ACCOUNT, EVERY DEVICE

SpentyAI runs natively on Android, iOS, and the web at spentyai.com. Sign in with Google on any platform — data syncs instantly. Start an entry on your phone, finish reconciliation on your laptop, check projections from any browser.

————————————————

BUILT FOR INDIA, WORKS GLOBALLY

INR with full UPI, NEFT, RTGS, IMPS, GST, and HSN/SAC support — for Indian freelancers, small businesses, and professionals. Multi-currency for international use, auto-detected from email content.

————————————————

PRIVACY-FIRST, BY DESIGN

✓ We read only transaction-related emails. Personal mail is never touched.
✓ Your data is yours. Export everything any time.
✓ AI uses OpenAI's API for categorisation, mandate detection, and chat. Only minimum required fields (transaction text, merchant, amount) are sent — never your full inbox or contacts.
✓ Delete your account any time and data is removed from our servers permanently.
→ Full policy: https://www.spentyai.com/privacy

————————————————

SUBSCRIPTION

Try Free for 7 Days — every feature unlocked, no charge until day 8.
Plans from Rs 199/month, Rs 449/quarter, Rs 1,499/year. Lifetime plan available.
Subscriptions auto-renew via Google Play. Manage or cancel any time from Play Store → Subscriptions.

————————————————

NEED HELP?

Online help centre with walkthroughs in English and Hindi: https://www.spentyai.com/help
Email: support@spentyai.com

Download SpentyAI and let AI take the stress out of your money.

(3985 / 4000 chars)

---

## Keywords for ASO (informational — Google doesn't have a keywords field but uses description)
AI accountant, AI bookkeeping, expense tracker, expense manager India, GST invoice, GST billing, UPI tracker, NEFT, RTGS, IMPS, subscription tracker, mandate finder, auto-debit tracker, NACH, UPI AutoPay, SIP tracker, bank reconciliation, cash flow forecast, debtor aging, creditor aging, HSN, SAC, receipt scanner, invoice maker, small business accounting, freelancer accounting, finance app India, money manager, double-entry bookkeeping, OpenAI

## Categorization
- **App category:** Finance
- **Tags:** Personal Finance, Budgeting, Expense Tracker, Accounting, Invoice
- **Content rating:** Everyone (3+)

## Contact
- **Email:** support@spentyai.com (use this for the public Play listing — primary support inbox; privacy@spentyai.com is for data-subject requests and goes in the Privacy Policy, not the listing)
- **Website:** https://www.spentyai.com
- **Privacy policy:** https://www.spentyai.com/privacy

---

## Notes for the human filling the form

**Truthfulness caveats vs the iOS description (these are why I trimmed certain claims):**

1. **No "Hindi UI toggle" claim in the description.** Per `qa/PARITY_MATRIX.md`, Hindi is NOT implemented in the Android app yet (no `values-hi/strings.xml`, no toggle). The iOS app has it, the Android app does not. I only mention Hindi in the context of the **online help centre** (`/help`), which IS live in both languages. If/when Hindi ships in-app, add a line under "BUILT FOR INDIA" like "Full app available in English and Hindi."

2. **No "in-app cancel" or "promo codes" claim.** Both are stubbed on Android (CRITICAL DEFECTS 3 & 4 in PARITY_MATRIX). The "Manage or cancel any time from Play Store → Subscriptions" wording sidesteps this — it's true and what Google Play requires anyway. Don't add a "use a promo code" pitch until promo endpoints are wired.

3. **No "SMS sync" claim.** iOS has a paste-based SMSSyncView; Android currently shows "Coming Soon" placeholder. Email auto-detection still works fully on Android, so the description leans on that.

4. **No "standalone Mandates screen" claim.** Mandates are detected and surfaced inside the cash-flow projection (which IS wired on Android), but there's no standalone Mandates list UI on Android yet. The copy says "detected mandates project month by month" — true on Android via CashFlowScreen — without overpromising a standalone Mandates list.

5. **No "Sign in with Apple" claim.** Apple sign-in is iOS-only by Apple's rules. The description correctly says "Sign in with Google" only.

6. **OpenAI mention is required for Data Safety form.** The "PRIVACY-FIRST" section explicitly names OpenAI and what data leaves the device. When you fill the Data Safety form, declare: Personal info → User IDs (collected, encrypted in transit, account-deletable). Financial info → Purchase history & user payment info (collected for transaction tracking, encrypted in transit, account-deletable). Messages → Emails (collected only when user connects Gmail/Outlook, processed by OpenAI for categorisation, encrypted in transit, account-deletable). App activity → In-app actions. Diagnostics → Crash logs. Do NOT tick "shared with third parties" — OpenAI is a processor, not a recipient.

7. **Help URL works today.** `/help` is live with 108 screenshots / 32 articles per memory — safe to publish the URL. The in-app link to it is a future Android polish item; the listing pointing users to the website is fine.

8. **"Native on Android, iOS, and the web" is true.** All three are real apps backed by the same `api.spentyai.com` backend.

9. **Pricing copy uses "Rs" (ASCII), not the rupee glyph.** Some Android devices and old browsers still mis-render `₹` in store listings; ASCII avoids the glitch. If Google's preview renders the glyph fine on a real device check, you can swap them globally.

10. **Trial mechanics need to match Play Console reality.** I wrote "no charge until day 8". Make sure the Play Console base plan has a 7-day free trial offer attached to all four products (`com.spentyai.monthly`, `.quarterly`, `.yearly`, `.lifetime`). Per CRITICAL DEFECT 1 in PARITY_MATRIX, the SKU naming was previously misaligned between BillingRepository and ViewModel — confirm the SKUs you list in Play Console match what the app queries before pushing this listing live.

11. **Screenshot guidance (not asked, but worth flagging):** Play wants 2–8 phone screenshots per language. Strongest order given description hierarchy: (1) Dashboard with net worth + cash-flow card, (2) AI chat showing a transaction logged from natural language, (3) Auto-detected subscriptions list inside CashFlow, (4) GST invoice preview, (5) Reconciliation conflict screen, (6) Reports breakdown, (7) Privacy / data screen. Capture from the live emulator (`Medium_Phone_API_36.1` per `spentyai_android_setup.md`).

12. **Do not submit to Play until the 7 critical Android billing defects in PARITY_MATRIX are fixed** — particularly SKU alignment, paywall enforcement, and the verify call. Otherwise the pricing this listing advertises isn't reachable for a meaningful share of installs.
