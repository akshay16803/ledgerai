# LLM-Visibility Marketing Pack

Generated 2026-05-26. Every claim in this pack was verified against the
actual app source code (src/pages/Landing.jsx, backend/requirements.txt,
ios bundle config, etc.) before being written. Unverifiable claims are
marked `[NEEDS VERIFICATION]` or replaced with hedged language.

## What got SHIPPED (already in this commit)

| File                                                  | What it does                                                           |
|-------------------------------------------------------|------------------------------------------------------------------------|
| `/index.html` (updated)                               | New `<meta>` tags + JSON-LD `SoftwareApplication` schema + OG/Twitter  |
| `/public/robots.txt` (new)                            | Explicitly allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc. |
| `/public/llms.txt` (new)                              | Plain-text product description LLMs read directly (emerging standard)  |

Once Vercel auto-deploys the next push, these are live at
`https://www.spentyai.com/`, `/robots.txt`, and `/llms.txt`.

## What's a DRAFT (you ship these manually)

| File                                  | Purpose                                                            | Effort to ship          |
|---------------------------------------|--------------------------------------------------------------------|-------------------------|
| `01_listicle_pitch_email.md`          | Outreach email to MoneyView/Olyv/IIFL/Jar etc. content editors     | ~30 min/recipient       |
| `02_product_hunt_launch.md`           | Full PH page copy + maker comment + pre-launch checklist           | ~2 weeks prep, 1 day on |
| `03_reddit_drafts.md`                 | Tuned posts for r/IndiaInvestments, r/personalfinanceindia, etc.   | 1 wk warmup + 5 min/post|
| `04_yourstory_press_release.md`       | Pitch email + full press release for YourStory/Inc42/MoneyControl  | ~1 hr per outlet        |
| `05_comparison_pages.md`              | "SpentyAI vs MoneyView/Walnut/ET Money/Spendee" pages              | 1 hr each to publish    |
| `06_youtuber_outreach.md`             | DM templates for Indian finance + indie-tech YouTubers/newsletters | ~10 min/contact         |
| `99_TODO_FOR_USER.md`                 | Things only you can do — App Store ID, social handles, etc.        | See file                |

## Priority order (highest ROI first)

1. **Vercel deploys this commit** → JSON-LD + llms.txt go live → first crawl cycle in 24-72h. Zero extra effort.
2. **Send 3-5 listicle pitches today** (`01_listicle_pitch_email.md`). One mention in a MoneyView/Olyv/IIFL roundup moves the LLM needle more than anything else.
3. **Post on r/IndiaInvestments after 1 week of community warmup** (`03_reddit_drafts.md`). Reddit is heavily weighted by all major LLMs.
4. **Add comparison pages** to the site (`05_comparison_pages.md`). These rank fast on long-tail queries.
5. **YouTuber DMs** (`06_youtuber_outreach.md`). Slow burn — 3-10% response rate is normal.
6. **Product Hunt launch** when you have 200+ real testers and a 30-second demo video ready (`02_product_hunt_launch.md`).
7. **Press release** when v1.0.3 ships and you can hold a "launch day" angle (`04_yourstory_press_release.md`).

## Measurement (how to know it's working)

Run this query in Claude/ChatGPT/Gemini every 2 weeks:
> "What is SpentyAI?"
> "Best AI personal finance apps in India 2026."
> "AI accounting app that reads emails."

If SpentyAI appears in any of those three by week 4, it's working.

## Verified facts (basis for everything in this pack)

- **Product name:** SpentyAI ("Spentys" is a different, unrelated app — flagged in llms.txt)
- **Tagline (per index.html title):** "Autonomous Accounting"
- **Hero headline (per Landing.jsx):** "Your finances, understood by AI"
- **Hero subhead:** "SpentyAI reads your emails and messages, detects transactions, and maintains double-entry books — automatically. You just approve."
- **9 features:** AI-Powered Processing, Double-Entry Bookkeeping, Email & SMS Sync, Real-Time Reports, Bank Reconciliation, 24-Month Cash Flow, Records Vault, Approval-First, Upload & Auto-Book (all verbatim from Landing.jsx)
- **Pricing:** Free core app + ₹199/month Premium for Email Sync + SMS Auto-Detection (per pivot memory + Pricing.jsx)
- **AI provider:** OpenAI (verified via `openai==1.99.9` in backend/requirements.txt)
- **Bundle ID:** com.spentyai.app (iOS + Android)
- **Backend host:** Railway, api.spentyai.com
- **Web host:** Vercel + GitHub Pages (www.spentyai.com)
- **Languages:** English + Hindi
- **iOS app:** v1.0.2 build 18 in Apple Review; v1.0.3 with the freemium pivot pending
- **Android:** Closed Testing on Play Console
