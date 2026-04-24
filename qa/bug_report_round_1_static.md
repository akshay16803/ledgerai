# SpentyAI QA — Round 1 Bug Report (static analysis, pre-simulator)

**Date:** 2026-04-24
**Source:** Findings surfaced by 5 parallel expert-QA agents reading the code.
**Total test cases authored:** 763 across 5 domains (A: 150, B: 184, C: 120, D: 109, E: 200).
**Next step:** simulator execution of all 763 cases once Xcode is rebuilt.

---

## P0 — App Store blockers (must fix before submission)

### BUG-1 — Voice mode still shows raw `**asterisks**` and truncates ("expense...")
**User impact:** In voice mode, AI's reply has literal `**Transaction Type**` instead of bold, and long replies cut off with "expense..." after ~4 lines.
**Root cause:** Code was fixed in commit cc83844. Xcode DerivedData cache serves stale binary.
**Fix:** Quit Xcode, rm -rf ~/Library/Developer/Xcode/DerivedData/SpentyAI-*, rebuild. 5 min. Needs computer-use approval.

### BUG-2 — Sign-out doesn't actually invalidate the server session
**User impact:** Tap "Sign out" → app returns to login. But server session lives 30 days. Token replay = instant re-auth.
**Root cause:** /api/auth/logout reads session_token from cookie ONLY. Mobile sends it as Authorization: Bearer. Server db.delete_many(...) never runs.
**Fix:** Accept token from Bearer header OR cookie. 5 min + deploy.

### BUG-3 — Invoice & Bill PDFs broken for Indian content
**User impact:** Rupee ₹ becomes "Rs.", Hindi/Marathi/Gujarati customer names become ?????, no business logo on PDF, no amount-in-words.
**Root cause:** _generate_invoice_pdf_bytes uses Helvetica (latin-1 only) and .encode("latin-1", "replace"). Devanagari chars destroyed.
**Fix:** Add Unicode TTF (DejaVu Sans / NotoSans-Devanagari) via pdf.add_font(uni=True); stop latin-1 replace; pdf.image(logo_path) at header; add amount-in-words via num2words. 45 min + deploy.

### BUG-4 — Settings missing Privacy / Terms / Refund Policy / Support / About links
**Apple risk:** Guideline 5.1.1 requires in-app privacy policy link. 3.1.2 requires subscription management affordance. Missing both.
**Current Settings:** Business Profile, Currency, Logo, Signature, Sign Out, Reset Data, Delete Account. No legal, no support, no version.
**Fix:** Add Legal section (Privacy/Terms/Refund/Acknowledgements), Support section (Help/Contact/Feedback), About row with version. 60 min.

### BUG-5 — Dev-simulator-login backdoor with hardcoded default secret
**Attack:** POST /api/auth/dev/simulator-login {email: "victim@x.com", dev_secret: "spenty-sim-bypass-2026"} → 30-day session for victim. Zero auth.
**Root cause:** server.py L568: expected_secret = os.environ.get("DEV_SIMULATOR_SECRET", "spenty-sim-bypass-2026"). Default is in the public repo.
**Fix:** Disable endpoint entirely in production (check ENV==production → 404). Require non-default secret explicitly. 10 min + Railway env var.

---

## P1 — High

### BUG-6 — SettingsView section headers + alert copy hard-coded English
Hindi users see mixed UI after language toggle.
**Fix:** Move SettingsView strings to AppStrings.swift. 45 min.

### BUG-7 — Siri Shortcut phrases English-only
Hindi/Hinglish Siri won't work.
**Fix:** Add HI/Hinglish phrases in AppShortcuts.swift. 20 min.

### BUG-8 — Reset Data wipes more than dialog promises
Also clears synced_emails, email_sync_config, outlook_sync_config, processing_locks. Re-sync creates duplicates.
**Fix:** Either update warning copy or preserve email dedup state. 30 min.

### BUG-9 — Delete Account failure leaves UI spinner stuck
SettingsViewModel.isLoading never reset on catch.
**Fix:** defer { isLoading = false } or set in both branches. 5 min.

### BUG-10 — Stuck-auth edge: 401 without keychain doesn't log out
APIClient session-expired gated on keychain!=nil; stale isAuthenticated=true leaves user stuck.
**Fix:** Also fire session-expired if isAuthenticated AND keychain empty. 10 min.

### BUG-11 — Language toggle only on Dashboard, not Settings
Users expect it in Settings (iOS convention).
**Fix:** Add Language row in Settings. 15 min.

---

## P2 — Medium

- BUG-12: Reports "This Year" uses calendar year, not India FY (Apr-Mar)
- BUG-13: Cash Flow has 24-month scroll but no 30/60/90-day toggle
- BUG-14: Support tickets are write-only (no list/reply/close)
- BUG-15: Bills folder named "Features/Purchases/" (cosmetic)
- BUG-16: Invoice form missing discount_percent (backend supports it)
- BUG-17: Landing footer doesn't link /refund-policy
- BUG-18: No in-app Help Center link from Settings (rolled into BUG-4)
- BUG-19: LocalizationManager no Hinglish locale (product decision)

---

## Submission readiness

Minimum to safely ship today: BUG-1 through BUG-5 (~2.5 hrs fix + 1 hr retest + archive/upload).
P1 bugs strongly recommended before submission.
P2 can ship with known-issues list.
