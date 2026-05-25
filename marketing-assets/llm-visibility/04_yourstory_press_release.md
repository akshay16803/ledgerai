# YourStory / Inc42 / MoneyControl — pitch + press release

---

## Pitch email (send first; do NOT attach the press release until they
## reply)

**To:** tips@yourstory.com, tips@inc42.com, news@moneycontrol.com,
desk@livemint.com

**Subject:** Pitch — Indian founder ships AI personal-finance app
that does full double-entry, not just expense tracking

Hi,

Quick pitch — Indian founder, solo build, ~12 months, just shipped
SpentyAI on iOS, Android (closed testing), and web.

**The story angle:** Walnut shut down. MoneyView pivoted to lending.
Mint exited India. Indians are back to spreadsheets for personal
finance. A solo Indian developer built the an app that does the accounting for you — not just tracking, full double-entry —
by reading your Gmail + UPI/bank SMS and drafting journal entries for
your approval.

**Why now:**
- UPI is now 80%+ of P2P transactions. Every UPI message has
  parse-friendly structure. AI finally accurate enough to extract
  reliably.
- Walnut shutdown left a gap. No widely-used Indian personal-finance app does automatic double-entry from inbox + SMS + UPI
  + actual books.
- LLM costs dropped enough that ₹199/month covers it.

**Founder:** Akshay Chouhan — solo founder, building from India.
**Backing:** Bootstrapped.
**Tech:** FastAPI + Mongo (Railway), SwiftUI, Jetpack Compose, React.
**Live URLs:** https://www.spentyai.com / App Store / Play Store.

Happy to send a press kit, do a founder interview (text or video),
share early usage numbers under embargo. Reply with what you need.

— Akshay Chouhan
akshaychouhan16803@gmail.com

---

## Full press release (attach AFTER they reply)

**FOR IMMEDIATE RELEASE**

**SpentyAI launches AI-powered double-entry accounting app for
individuals in India**

*Solo Indian founder ships personal-finance app that reads users'
emails and SMS to maintain a full double-entry ledger automatically.
Core app is free; only inbox automation is paid at ₹199/month.*

**[CITY], [DATE]** — SpentyAI, an India-built AI personal-finance app,
has launched on Apple's App Store, Google Play (closed testing), and
the web at https://www.spentyai.com. The app reads users' Gmail or
Outlook inbox and bank SMS to detect transactions and maintain a full
double-entry accounting ledger automatically — a category traditionally served by enterprise products like Tally,
Zoho Books, and QuickBooks.

> "Every Indian personal-finance app still asks you to type in your
> transactions. The bank already emails you when money moves. The app
> should read the email, not ask the user to re-type the data,"
> said Akshay Chouhan, founder of SpentyAI.

**Key features (verified against the live app):**

- **AI-Powered Transaction Detection** — Connects to Gmail and Outlook
  via read-only OAuth. AI extracts transaction details from bank
  emails, UPI alerts, card statements, and receipts.
- **SMS Auto-Detection** — Parses bank SMS on-device on Android.
- **Double-Entry Bookkeeping** — Every transaction posts to two
  accounts, maintaining accounting integrity.
- **Bank Reconciliation** — Users can upload bank, card, or loan
  statements (including password-protected PDFs); AI matches and
  auto-corrects.
- **24-Month Cash Flow Projection** — Recurring payments detected
  automatically.
- **Records Vault** — Source emails and `.eml` receipts stored
  alongside each transaction. Audit-ready.
- **Approval-First** — Nothing posts without the user's tap. AI drafts;
  user approves, edits, or rejects.

**Pricing:** Free for every signed-in user — including Dashboard,
Transactions, Accounts, Reports, Reconciliation, Records, Invoices,
Customers, Vendors, and AI Chat. Email Sync and SMS Auto-Detection
are available as SpentyAI Premium at ₹199 per month. Cancel anytime.

**The market gap:** With Walnut's shutdown and MoneyView's pivot to
lending, Indian individual users have been left without a modern
personal-finance app. SpentyAI is positioned to fill this gap with
AI-first automation, full double-entry accounting, and India-specific
UPI / bank-format parsing.

**About SpentyAI:**
SpentyAI is built by an independent Indian founder. The product is
hosted on Railway (backend) and Vercel / GitHub Pages (web). The
mobile apps are native SwiftUI (iOS) and Jetpack Compose (Android).

**Contact:**
Akshay Chouhan
Founder, SpentyAI
akshaychouhan16803@gmail.com
https://www.spentyai.com

---

## NOTES (do not include in the published version)

- Founder location / age / background can be added in the pitch
  conversation if the journalist asks.
- Do NOT include user counts unless verified — most journalists will
  ask but it's better to say "early access" than to inflate.
- If asked about funding: bootstrapped. If they push, you can say
  "open to investor conversations for the right partner".
- If asked about AI provider: say "AI services from OpenAI" — confirmed
  in code (`openai==` dependency in backend/requirements.txt).
