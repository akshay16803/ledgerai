# SpentyAI Brand Kit

Single source of truth for visual identity. Use this for **every** creative — App Store screenshots, social posts, ads, decks, marketing emails, video thumbnails, partner one-pagers.

**Source of truth in code:** `src/index.css` (CSS variables) and `src/pages/Landing.jsx` (typography + tagline). If those drift, update this file to match.

---

## 1. Aesthetic in one line

Warm-minimal-serif. **Stripe meets Aesop.** Not techy-blue, not fintech-gradient, not Razorpay/Cred.

The vibe is calm, considered, and editorial. Cream paper, deep forest ink, one bright green for emphasis. White space is a feature.

---

## 2. Color palette

### Primary surface — warm neutrals

| Token | Hex | Use |
|---|---|---|
| `--bg-primary` | `#F9F8F6` | Default canvas. Almost-white but warm, never `#FFFFFF`. |
| `--bg-secondary` | `#F2EBE5` | Cards, callouts, alternating sections. |
| `--bg-tertiary` | `#EAE4DD` | Pressed states, footers, deeper accents. |

### Type

| Token | Hex | Use |
|---|---|---|
| `--text-primary` | `#1A362D` | Hero text + body headings. Reads as near-black but is deep forest green. |
| `--text-secondary` | `#4A5D55` | Body copy. |
| `--text-muted` | `#7A8A82` | Captions, eyebrow labels, footnotes. |

### Brand + accents

| Token | Hex | Use |
|---|---|---|
| `--brand-primary` / `--accent-1` | `#34C759` | Apple-style green. The ONLY bright color. CTAs, italic accent words, success state. Use sparingly. |
| `--accent-2` | `#DDA77B` | Warm tan/peach. Secondary highlight. |
| `--accent-3` | `#8E9E82` | Sage. Rules, dividers, decorative strokes. |

### Status colors

| Token | Hex |
|---|---|
| `--success` | `#34C759` (same as brand) |
| `--warning` | `#C28C3C` |
| `--error` | `#FF3B30` |
| `--info` | `#4A6E7D` |

### Dark area (sidebar, premium gates, dark sections)

| Token | Hex |
|---|---|
| Background | `#1A2E23` |
| Text | `#B8CFC2` |
| Active item | `#FFFFFF` |

---

## 3. Typography

Three families. No others. Ever.

### Playfair Display — headings

- Weights: 400, 500, 600, 700
- Italic available — used on the one accent word in `--accent-1` green
- Always tight tracking (letter-spacing 0 or slight negative)

### Manrope — body

- Weights: 300, 400, 500, 600, 700
- Default body weight: 400
- Buttons + nav: 600

### IBM Plex Mono — eyebrows + technical labels

- Weights: 400, 500, 600
- Always UPPERCASE
- Letter-spacing `+0.08em` to `+0.12em`
- Brand green color (`#34C759`) when used as an eyebrow above a hero

All three are on Google Fonts — install with one CSS import or load via `<link>`.

---

## 4. Voice and tagline (verbatim)

These strings ship in production. Do not paraphrase without explicit approval.

**Page `<title>`:**
> SpentyAI — Autonomous Accounting

**Hero eyebrow (caps, mono, green):**
> AI-POWERED ACCOUNTING

**Hero H1:**
> Your finances,
> *understood* by AI

(line break before "understood"; "understood" is italic in `#34C759`; the rest is `#1A362D` Playfair regular)

**Hero subhead:**
> SpentyAI reads your emails and messages, detects transactions, and maintains double-entry books — automatically. You just approve.

**Short tagline (one-liner for ads, App Store subtitle, etc.):**
> AI Accounting & Bookkeeping

---

## 5. Logo + icon

App icon lives at `ios/SpentyAI/SpentyAI/Assets.xcassets/AppIcon.appiconset/` (iOS) and `android-native/app/src/main/res/mipmap-*/` (Android). Same artwork on both stores as of 2026-05-07. Do not regenerate from a different source — fork from the existing master if you need new sizes.

When the wordmark appears separately from the icon, set it in Playfair Display 600 (no italic), `--text-primary` color, on `--bg-primary` background.

---

## 6. Layout rules

- **Whitespace is the design.** Default to twice the padding you think you need.
- **Hero text is huge.** H1 is 64-96px on desktop, 40-56px on mobile.
- **One accent color per composition.** Green or peach, never both.
- **Photography:** soft natural light, neutral backgrounds, no stock blue gradients. If using product mockups, place an iPhone with `--bg-primary` showing.
- **No drop shadows below 8px blur, no glassmorphism, no fintech gradients.**

---

## 7. Do / Don't

### Do
- Pair `--text-primary` deep green ink on `--bg-primary` warm off-white.
- Use one italic word per heading max, always in `--accent-1` green.
- Use IBM Plex Mono uppercase + green for eyebrow labels.
- Leave generous margins. White space is brand-signal.

### Don't
- Don't use pure `#FFFFFF` as background — it kills the warmth.
- Don't use blue. The product is Indian fintech-adjacent; the temptation is real. Resist it.
- Don't use Tailwind's default `gray-*` or `blue-*` — they read cold.
- Don't add gradients except very subtle paper-textures.
- Don't use more than one accent color in a single creative.

---

## 8. Quick palette card

For when you need to glance at hex codes while in Canva/Figma:

```
BG       #F9F8F6   #F2EBE5   #EAE4DD
INK      #1A362D   #4A5D55   #7A8A82
BRAND    #34C759   #DDA77B   #8E9E82
STATUS   #34C759   #C28C3C   #FF3B30   #4A6E7D
DARK     #1A2E23   #B8CFC2   #FFFFFF
```

---

## 9. Where this came from

Extracted on 2026-05-05 directly from the production CSS variables in `src/index.css` and the landing-page typography in `src/pages/Landing.jsx`. Re-verified periodically — when in doubt, those files win.

This file should be updated whenever a marketing creative is rejected for being off-brand, so future creatives have one more constraint encoded.
