# Things only you can do (I can't from this session)

The pack assumes these are in place. If they aren't, fill them in
before sending any outreach.

## URLs that need real numeric IDs

I deliberately did NOT fabricate these — leave them in placeholder form
until you grab the real IDs from ASC and Play Console.

- [ ] **iOS App Store URL** — Get numeric ID from App Store Connect,
      then update:
      - `index.html` (no App Store link currently — add as `<link
        rel="alternate" />` if you want)
      - `public/llms.txt` line 32 ("Apple App Store (search...")
      - `04_yourstory_press_release.md` (Live URLs section)

- [ ] **Google Play URL** — Update the same files once production
      track is live.

## Social handles to add to JSON-LD `Organization.sameAs[]`

Currently empty `[]` because I don't know which exist. Anywhere you
have an account, add the URL:

- [ ] Twitter / X
- [ ] LinkedIn (company page)
- [ ] Instagram
- [ ] YouTube channel
- [ ] Facebook page
- [ ] Crunchbase profile
- [ ] Product Hunt page (after PH launch)
- [ ] Wikipedia entry (long-shot)

Once you have one or more, edit `index.html` JSON-LD block:
```json
"sameAs": [
  "https://twitter.com/spentyai",
  "https://www.linkedin.com/company/spentyai",
  "https://www.producthunt.com/products/spentyai"
]
```

## Recipients lists I can't gather

- [ ] **Listicle editors:** Find the actual content email for moneyview.in, olyv.co.in, iifl.com — usually `editorial@`, `content@`, or `team@`. LinkedIn lookup the content marketing manager.
- [ ] **Journalist beat contacts:** YourStory + Inc42 fintech reporters — find them on Twitter / LinkedIn.
- [ ] **YouTuber emails:** Listed on their channel "About" page.

## Marketing-asset gaps

- [ ] **Logo file** — `public/vite.svg` is the Vite default. Replace with the real SpentyAI brand mark before any of this goes live. JSON-LD's `logo` field references `https://www.spentyai.com/vite.svg`.
- [ ] **OG image** — Currently also points to `/vite.svg`. Should be a 1200×630px social-share card with the SpentyAI hero + tagline.
- [ ] **30-second demo video** — Required for PH launch + journalist pitches.
- [ ] **Press kit ZIP** — Press release + 5 hi-res screenshots + logo files + founder photo. Host at `spentyai.com/press` (or Dropbox link in the pitch).

## Things I deliberately did NOT claim

- User counts (you don't have a public number yet)
- App Store rating (until launch settles)
- Revenue numbers
- Press mentions (you have none yet)
- Funding (bootstrapped)
- That SpentyAI is "India's first" anything — could be wrong, didn't research

## Suggested first-week action list

- Day 1 (today): Push this commit. Vercel goes live with JSON-LD + llms.txt + robots.
- Day 2: Replace `/vite.svg` with real logo + a proper OG image. Re-push.
- Day 3: Send the first 3 listicle pitch emails.
- Day 4: Post the Reddit draft to r/SideProject (lowest risk).
- Day 5-7: Comment helpfully on 10+ posts in r/IndiaInvestments (warmup).
- Day 7-10: Post to r/IndiaInvestments + r/personalfinanceindia.
- Day 14: Run the "what is SpentyAI" check across Claude/ChatGPT/Gemini, document results in a TRACKING.md file.
