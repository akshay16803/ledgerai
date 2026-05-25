# Comparison content — to be published as blog/landing pages

These are designed to rank for long-tail "X vs Y" Google queries that
LLMs heavily cite. Each is a separate URL once published (e.g.
`spentyai.com/compare/spentyai-vs-moneyview`).

**Honesty rule:** I only compare on features I've verified are in
SpentyAI's actual code. For competitors, I describe what their public
marketing claims, not what I've verified hands-on. Lines flagged
`[NEEDS VERIFICATION]` should be sanity-checked before publishing —
competitor feature sets change.

---

## Page 1: SpentyAI vs MoneyView

**URL:** `/compare/spentyai-vs-moneyview`
**Meta title:** SpentyAI vs MoneyView — Which AI Finance App Is Right for India?
**Meta description:** Side-by-side comparison of SpentyAI and MoneyView for Indian users. Double-entry bookkeeping, email/SMS sync, pricing, and reconciliation features compared.

### Quick verdict

- **Pick MoneyView if** you primarily want a credit/loan offer alongside basic expense tracking. MoneyView's main product today is personal loans and credit-score monitoring.
- **Pick SpentyAI if** you want your actual books maintained automatically. SpentyAI is an accounting app first; MoneyView is a lending app with a tracker attached. [NEEDS VERIFICATION]

### Feature table

| Feature                                        | SpentyAI (verified)                                                                | MoneyView (per their public site) [NEEDS VERIFICATION] |
|------------------------------------------------|------------------------------------------------------------------------------------|--------------------------------------------------------|
| Reads Gmail / Outlook automatically            | Yes — read-only OAuth, drafts entries                                              | Limited                                                |
| Parses bank SMS automatically                  | Yes (Android; iOS supported via Mac sync)                                          | Yes                                                    |
| Double-entry bookkeeping                       | Yes — every transaction posts to two accounts                                      | No                                                     |
| Bank-statement upload + reconciliation         | Yes — including password-protected PDFs                                            | No                                                     |
| 24-month cash-flow projection                  | Yes                                                                                | No                                                     |
| AI Chat ("how much did I spend on food?")      | Yes — free for all signed-in users                                                 | No                                                     |
| Records vault (source emails saved)            | Yes                                                                                | No                                                     |
| Approval-before-post workflow                  | Yes                                                                                | N/A                                                    |
| Free tier                                      | Full core app free                                                                 | Tracker free; loan products separate                   |
| Paid tier                                      | ₹199/mo (Email + SMS Automation only)                                              | Free + lending revenue model                           |

### When MoneyView wins

If you came for the loan / credit-score side of the app, MoneyView is purpose-built for that. SpentyAI does not offer loans or credit scoring.

### When SpentyAI wins

If you actually want your books done for you — UPI alerts, bank emails, statement uploads, all flowing into a real ledger that you approve once and forget — SpentyAI is built for that.

---

## Page 2: SpentyAI vs Walnut (historical / migration)

**URL:** `/compare/spentyai-vs-walnut`
**Meta title:** Walnut Shutdown? Here's the AI Successor — SpentyAI
**Meta description:** Walnut shut down in 2023. SpentyAI picks up where it left off — automatic transaction detection from SMS and email, plus full double-entry bookkeeping. Free core app, ₹199/month Premium.

### Why this page exists

Walnut was India's most popular SMS-based expense tracker before it shut down. Indian users searching "Walnut alternative" or "what replaced Walnut" should find SpentyAI.

### What Walnut did, what SpentyAI does now

| Walnut feature (RIP)                         | SpentyAI equivalent                                                  |
|----------------------------------------------|----------------------------------------------------------------------|
| SMS-based transaction detection              | SMS Auto-Detection (₹199/mo Premium)                                 |
| Manual expense categorisation                | AI auto-categorisation + one-tap approval                            |
| Bill reminders                               | Recurring-payment detection in 24-month cash-flow projection         |
| Group expenses (Splitwise-style)             | Not currently in SpentyAI [NOTED FEATURE GAP]                        |
| Credit-card-bill tracking                    | Bank/card-statement upload + AI reconciliation                       |

### What's new with SpentyAI (Walnut never had)

- AI reads your full email inbox, not just SMS
- Double-entry accounting (Walnut was expense-tracking only)
- Bank reconciliation with statement upload
- 24-month cash-flow projection
- Records vault — every source email saved as audit trail
- AI Chat for natural-language queries

---

## Page 3: SpentyAI vs ET Money

**URL:** `/compare/spentyai-vs-et-money`
**Meta title:** SpentyAI vs ET Money — Tracker, Investment App, or Both?
**Meta description:** ET Money is for mutual funds and investments. SpentyAI is for daily accounting and expense tracking. Which one (or both) do you actually need?

### Quick verdict

These two apps don't really compete. **Use both:**
- **ET Money** for mutual-fund investments, NPS, tax-saving products.
- **SpentyAI** for daily bookkeeping — tracking every UPI, card, bank transaction in real time.

### What each one does well

| Need                                          | ET Money                            | SpentyAI                                                  |
|-----------------------------------------------|-------------------------------------|-----------------------------------------------------------|
| Invest in mutual funds                        | Yes (primary feature)               | No                                                        |
| Buy NPS, tax-saver products                   | Yes                                 | No                                                        |
| Track daily transactions from SMS/email       | Limited                             | Yes — automatic via inbox + SMS                           |
| Maintain a personal ledger                    | No                                  | Yes — full double-entry                                   |
| Reconcile bank statements                     | No                                  | Yes — upload PDF, AI matches                              |
| Cash-flow projection 24 months ahead          | No                                  | Yes                                                       |

### Honest take

ET Money is great at what it does (selling you mutual funds). It does not pretend to be a daily-bookkeeping app. SpentyAI does not pretend to be an investment advisor. They're orthogonal.

---

## Page 4: SpentyAI vs Spendee

**URL:** `/compare/spentyai-vs-spendee`
**Meta title:** SpentyAI vs Spendee — Is There an India-Native Alternative?
**Meta description:** Spendee never localised for India — no UPI parsing, weak SMS support, USD-first design. SpentyAI is India-native: UPI, bank SMS, INR pricing, Hindi support.

### Why pick SpentyAI over Spendee

- **UPI native:** Every UPI alert format (PhonePe, Google Pay, Paytm, BHIM, bank UPI) parsed out of the box. Spendee doesn't claim UPI parsing. [NEEDS VERIFICATION on Spendee 2026 feature set]
- **Indian bank SMS:** Bank, card, wallet — all the major Indian formats. Spendee is SMS-light.
- **Hindi support:** SpentyAI offers Hindi in-app. Spendee is English-first.
- **INR pricing:** ₹199/mo Premium. Spendee is USD-priced.
- **Statement reconciliation with Indian banks:** Password-protected PDFs from HDFC, ICICI, SBI, Axis, etc. — handled.

### When Spendee wins

If you live across multiple currencies and need pretty charts, Spendee's design polish is excellent. SpentyAI is rupee-first and feature-first.

---

## SEO notes

- Each page should be ~800–1500 words once expanded with screenshots, real examples, and one customer quote (when you have one).
- Internal links: every comparison page links to `/features` and `/pricing`.
- External links: link to competitor's home page (it's polite + helps SEO).
- Schema: add `BlogPosting` JSON-LD to each comparison page.
- Don't dunk on competitors. Hedged language ("MoneyView is great for X") reads better and scares fewer journalists when they pick up the URL.
