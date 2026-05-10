"""Marketing screenshots for App Store + Play Store.

Layout fixes vs. the previous generator:
  - Tagline + subhead live ABOVE the phone, never overlap the screen
  - Phone frame is large (≈ 75% of canvas height) so the app UI is readable
  - Screen content is rendered at proper scale (was cramped before)
  - Uses a gradient background so the headline pops without a flat block
  - Renders both Play Store (1080×1920) AND App Store iPhone 6.9"
    (1320×2868) so the same source data drives every store

The 6 marketing taglines + dummy data are kept identical to the
previous version that was already approved for the App Store
listing — only the LAYOUT changes.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# ───── Brand palette ─────────────────────────────────────────────
GREEN_DARK   = (26, 60, 42)
GREEN        = (40, 88, 64)
GREEN_LIGHT  = (88, 156, 110)
GREEN_PALE   = (224, 240, 230)
GREEN_VPALE  = (242, 248, 244)
WHITE        = (255, 255, 255)
DARK         = (24, 32, 28)
GREY         = (138, 142, 138)
LIGHT_GREY   = (236, 240, 236)
RED          = (200, 110, 110)
RED_BG       = (248, 232, 232)

# ───── Fonts ────────────────────────────────────────────────────
# Both bold and regular rely on Arial Unicode (or Helvetica Neue)
# because they're the easy-to-find macOS fonts that include the
# rupee sign U+20B9 — which appears 30+ times in our marketing
# screenshots and looked like ☐ tofu otherwise. We also try
# index-1 of HelveticaNeue.ttc for bold weight.
FONT_BOLD_CANDIDATES = [
    ("/System/Library/Fonts/HelveticaNeue.ttc", 1),       # Helvetica Neue Bold
    ("/Library/Fonts/Arial Unicode.ttf", 0),
    ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 0),
    ("/System/Library/Fonts/Supplemental/Verdana Bold.ttf", 0),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
]
FONT_REG_CANDIDATES = [
    ("/System/Library/Fonts/HelveticaNeue.ttc", 0),       # Helvetica Neue Regular
    ("/Library/Fonts/Arial Unicode.ttf", 0),
    ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 0),
    ("/System/Library/Fonts/Supplemental/Arial.ttf", 0),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0),
]

def _first_loadable(candidates, size):
    for path, idx in candidates:
        if not os.path.exists(path):
            continue
        try:
            return ImageFont.truetype(path, size, index=idx)
        except Exception:
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

def bold(size):
    return _first_loadable(FONT_BOLD_CANDIDATES, size)

def reg(size):
    return _first_loadable(FONT_REG_CANDIDATES, size)

def tsize(d, text, f):
    b = d.textbbox((0, 0), text, font=f)
    return b[2] - b[0], b[3] - b[1]

# ───── Layout spec ──────────────────────────────────────────────
# scale_factor maps from the 1080×1920 (Play Store) base to the
# target canvas, so all the UI elements rendered inside the phone
# look identical at both sizes.
class Layout:
    def __init__(self, w, h, label):
        self.W = w
        self.H = h
        self.label = label
        # Headline area — compact, sits cleanly above the phone with no
        # overlap. Sizes were tuned by rendering each screen and checking
        # the output: 0.046 on h is the largest headline that lets the
        # longest tagline ("See What's Coming. Plan Ahead." — 30 chars)
        # wrap to two lines instead of three.
        self.head_top   = int(h * 0.045)
        self.head_size  = int(h * 0.046)
        self.sub_size   = int(h * 0.022)
        # Phone area — pushed down enough that even a 2-line head + 2-line
        # sub never overlap the phone's top edge.
        self.phone_top  = int(h * 0.30)
        self.phone_h    = int(h * 0.62)
        # Phone width: slightly wider than a real iPhone so the screen
        # accommodates more content per row.
        self.phone_w    = int(self.phone_h * 0.52)
        # Center horizontally
        self.phone_x    = (w - self.phone_w) // 2
        # Bezel structure must match draw_phone_frame() exactly so the
        # screen area we author content for ends up in the same pixel
        # region the frame draws white into.
        self.band_thickness   = max(6, int(self.phone_w * 0.012))
        self.bezel_thickness  = max(int(self.phone_w * 0.022), 14)
        self.bezel            = self.band_thickness + self.bezel_thickness
        self.screen_x   = self.phone_x + self.bezel
        self.screen_y   = self.phone_top + self.bezel
        self.screen_w   = self.phone_w - 2 * self.bezel
        self.screen_h   = self.phone_h - 2 * self.bezel
        # Internal scale factor — content authored against a 720px-logical
        # screen width (smaller than 1024 → renders the UI ~45% larger, so
        # fonts and rows are clearly readable in the marketing canvas and
        # the screen feels properly full instead of half-empty).
        self.scale      = self.screen_w / 720.0

    def s(self, n):  # scale a logical pixel value
        return int(round(n * self.scale))


# ───── Background + headline ────────────────────────────────────
def draw_background_and_headline(layout, headline, subhead):
    """Vertical gradient (top dark green → bottom light green) with
    the headline + subhead living above the phone area."""
    img = Image.new("RGB", (layout.W, layout.H), GREEN_DARK)
    px = img.load()
    # Two-stop gradient: GREEN_DARK at top → GREEN_LIGHT at bottom
    for y in range(layout.H):
        t = y / layout.H
        r = int(GREEN_DARK[0] * (1 - t) + GREEN_LIGHT[0] * t)
        g = int(GREEN_DARK[1] * (1 - t) + GREEN_LIGHT[1] * t)
        b = int(GREEN_DARK[2] * (1 - t) + GREEN_LIGHT[2] * t)
        for x in range(layout.W):
            px[x, y] = (r, g, b)

    d = ImageDraw.Draw(img)

    # Headline (centered, wrapped to ≤ ~92% width — wider than before so
    # taglines like "See What's Coming. Plan Ahead." fit on 2 lines)
    head_font = bold(layout.head_size)
    sub_font  = reg(layout.sub_size)
    max_w = int(layout.W * 0.92)

    def wrap(text, font):
        words = text.split()
        lines, cur = [], ""
        for w in words:
            trial = (cur + " " + w).strip()
            tw, _ = tsize(d, trial, font)
            if tw <= max_w:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    head_lines = wrap(headline, head_font)
    sub_lines  = wrap(subhead, sub_font)

    y = layout.head_top
    head_lh = int(layout.head_size * 1.08)
    for line in head_lines:
        tw, _ = tsize(d, line, head_font)
        d.text(((layout.W - tw) // 2, y), line, fill=WHITE, font=head_font)
        y += head_lh
    y += int(layout.head_size * 0.35)

    sub_lh = int(layout.sub_size * 1.18)
    for line in sub_lines:
        tw, _ = tsize(d, line, sub_font)
        d.text(((layout.W - tw) // 2, y), line, fill=GREEN_PALE, font=sub_font)
        y += sub_lh

    return img, d


# ───── Phone frame ──────────────────────────────────────────────
def draw_phone_frame(img, layout):
    """iPhone-grade phone mockup with:
       • Titanium-look outer band with a subtle vertical gradient
       • Inky-black bezel ring around the screen
       • Properly proportioned Dynamic Island
       • Soft side-button silhouettes
       • Layered drop shadow + a faint top-edge highlight
    """
    px, py, pw, ph = layout.phone_x, layout.phone_top, layout.phone_w, layout.phone_h
    outer_radius = int(pw * 0.095)
    band_thickness = max(6, int(pw * 0.012))         # titanium edge
    bezel_thickness = max(int(pw * 0.022), 14)        # black bezel inside the band
    inner_radius = max(outer_radius - band_thickness - bezel_thickness // 2, 12)

    # ── 1. Soft drop shadow ─────────────────────────────────────
    shadow_layer = Image.new("RGBA", (layout.W, layout.H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    for off in range(0, 28, 2):
        alpha = max(4, 28 - off)
        sd.rounded_rectangle(
            [(px - off, py + 10 + off),
             (px + pw + off, py + ph + 14 + off)],
            radius=outer_radius + off,
            fill=(0, 0, 0, alpha),
        )
    img.paste(shadow_layer, (0, 0), shadow_layer)

    d = ImageDraw.Draw(img)

    # ── 2. Outer titanium band — vertical gradient ──────────────
    # Build a small RGBA tile that has the gradient, then mask it
    # with a rounded rectangle to get the phone outline.
    band_layer = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band_layer)
    # Mask: rounded rectangle filled white
    mask = Image.new("L", (pw, ph), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([(0, 0), (pw - 1, ph - 1)], radius=outer_radius, fill=255)
    # Gradient fill — Black Titanium, like iPhone 15 Pro / 16 Pro.
    # Top is ever-so-slightly lit (where ambient light would catch the edge),
    # middle is the deep titanium body, bottom is the darkest.
    grad_top = (74, 78, 86)            # subtle titanium reflection
    grad_mid = (32, 34, 40)
    grad_bot = (14, 14, 18)            # almost-black at bottom
    for y in range(ph):
        t = y / ph
        if t < 0.5:
            r = int(grad_top[0] * (1 - t * 2) + grad_mid[0] * (t * 2))
            g = int(grad_top[1] * (1 - t * 2) + grad_mid[1] * (t * 2))
            b = int(grad_top[2] * (1 - t * 2) + grad_mid[2] * (t * 2))
        else:
            t2 = (t - 0.5) * 2
            r = int(grad_mid[0] * (1 - t2) + grad_bot[0] * t2)
            g = int(grad_mid[1] * (1 - t2) + grad_bot[1] * t2)
            b = int(grad_mid[2] * (1 - t2) + grad_bot[2] * t2)
        bd.line([(0, y), (pw - 1, y)], fill=(r, g, b, 255))
    band_layer.putalpha(mask)
    img.paste(band_layer, (px, py), band_layer)

    d = ImageDraw.Draw(img)

    # ── 3. Inky-black bezel ring (sits inside the titanium band) ─
    bx0 = px + band_thickness
    by0 = py + band_thickness
    bx1 = px + pw - band_thickness
    by1 = py + ph - band_thickness
    bezel_radius = outer_radius - band_thickness
    d.rounded_rectangle(
        [(bx0, by0), (bx1, by1)],
        radius=bezel_radius,
        fill=(8, 8, 10),
    )

    # ── 4. Inner screen (white) ─────────────────────────────────
    sx = bx0 + bezel_thickness
    sy = by0 + bezel_thickness
    sx1 = bx1 - bezel_thickness
    sy1 = by1 - bezel_thickness
    sw = sx1 - sx
    sh = sy1 - sy
    d.rounded_rectangle(
        [(sx, sy), (sx1, sy1)],
        radius=inner_radius,
        fill=WHITE,
    )

    # ── 5. Dynamic Island — proper iPhone proportions ───────────
    # Real Dynamic Island ≈ 125 logical pt wide × 37 tall on iPhone 15.
    # Phone width pw ≈ 393 logical pt → island ≈ 31.8% of width.
    island_w = int(pw * 0.32)
    island_h = int(island_w * 0.30)
    island_x = px + (pw - island_w) // 2
    island_y = sy + int(island_h * 0.35)
    d.rounded_rectangle(
        [(island_x, island_y), (island_x + island_w, island_y + island_h)],
        radius=island_h // 2,
        fill=(0, 0, 0),
    )
    # Tiny camera sensor dot inside the island (right side)
    cam_d = int(island_h * 0.36)
    cam_x = island_x + island_w - cam_d - int(island_h * 0.28)
    cam_y = island_y + (island_h - cam_d) // 2
    d.ellipse(
        [(cam_x, cam_y), (cam_x + cam_d, cam_y + cam_d)],
        fill=(28, 36, 50),
    )

    # ── 6. Side button silhouettes — power on right, volume on left
    btn_color = (88, 92, 100)
    # Power button (right side, ~upper third)
    pwr_y = py + int(ph * 0.22)
    pwr_h = int(ph * 0.10)
    d.rectangle(
        [(px + pw - 1, pwr_y), (px + pw + max(2, band_thickness // 3), pwr_y + pwr_h)],
        fill=btn_color,
    )
    # Volume up
    vu_y = py + int(ph * 0.20)
    vu_h = int(ph * 0.06)
    d.rectangle(
        [(px - max(2, band_thickness // 3), vu_y), (px, vu_y + vu_h)],
        fill=btn_color,
    )
    # Volume down
    vd_y = py + int(ph * 0.28)
    vd_h = int(ph * 0.06)
    d.rectangle(
        [(px - max(2, band_thickness // 3), vd_y), (px, vd_y + vd_h)],
        fill=btn_color,
    )
    # Action button / mute (smaller, above volume up)
    act_y = py + int(ph * 0.13)
    act_h = int(ph * 0.04)
    d.rectangle(
        [(px - max(2, band_thickness // 3), act_y), (px, act_y + act_h)],
        fill=btn_color,
    )

    # ── 7. Top-edge highlight — a faint white line that sells the curve
    hl_layer = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl_layer)
    hd.rounded_rectangle(
        [(2, 2), (pw - 3, int(ph * 0.18))],
        radius=outer_radius - 2,
        outline=(255, 255, 255, 38),
        width=2,
    )
    img.paste(hl_layer, (px, py), hl_layer)

    return sx, sy, sw, sh


def status_bar(d, sx, sy, sw, layout):
    """Time + battery line at the very top of the inner screen.
    Positioned below where the Dynamic Island sits so they don't visually
    fight each other; matches iPhone's safe-area inset for status text."""
    f_t = bold(layout.s(26))
    f_b = reg(layout.s(22))
    bar_y = sy + layout.s(36)
    d.text((sx + layout.s(54), bar_y), "9:41", fill=DARK, font=f_t)
    bw, _ = tsize(d, "100%", f_b)
    d.text((sx + sw - layout.s(54) - bw, bar_y + layout.s(2)), "100%",
           fill=DARK, font=f_b)


# ═══════════════════════════════════════════════════════════════
# Six screen renderers (each draws content into the phone screen)
# ═══════════════════════════════════════════════════════════════

def screen_talk_ai(img, layout):
    d = ImageDraw.Draw(img)
    sx, sy, sw, sh = draw_phone_frame(img, layout)
    status_bar(d, sx, sy, sw, layout)
    s = layout.s
    # Push content below the status bar + Dynamic Island so they don't collide.
    sy += s(56)

    # Header
    d.text((sx + s(40), sy + s(96)), "SpentyAI Assistant",
           fill=DARK, font=bold(s(38)))
    d.text((sx + s(40), sy + s(146)), "Online · responds instantly",
           fill=GREY, font=reg(s(22)))
    d.line([(sx + s(40), sy + s(196)),
            (sx + sw - s(40), sy + s(196))],
           fill=LIGHT_GREY, width=2)

    # First user bubble
    ub_y = sy + s(220)
    ub_h = s(140)
    d.rounded_rectangle(
        [(sx + s(40), ub_y), (sx + sw - s(40), ub_y + ub_h)],
        radius=s(28), fill=GREEN_PALE,
    )
    d.text((sx + s(64), ub_y + s(28)),
           "I spent ₹500 on lunch",
           fill=DARK, font=reg(s(30)))
    d.text((sx + s(64), ub_y + s(72)),
           "from HDFC card",
           fill=DARK, font=reg(s(30)))

    # AI bubble 1
    ai_y = ub_y + ub_h + s(36)
    ai_h = s(270)
    d.rounded_rectangle(
        [(sx + s(40), ai_y), (sx + sw - s(40), ai_y + ai_h)],
        radius=s(28), fill=GREEN,
    )
    d.text((sx + s(64), ai_y + s(28)),
           "Logged ₹500 to Food",
           fill=WHITE, font=bold(s(34)))
    d.text((sx + s(64), ai_y + s(76)),
           "category, HDFC card.",
           fill=WHITE, font=reg(s(30)))
    d.text((sx + s(64), ai_y + s(140)),
           "Total food this month:",
           fill=(200, 230, 210), font=reg(s(26)))
    d.text((sx + s(64), ai_y + s(178)),
           "₹4,290 (Budget ₹6,000)",
           fill=WHITE, font=bold(s(30)))
    d.text((sx + s(64), ai_y + s(228)),
           "Tap to approve",
           fill=(180, 220, 200), font=reg(s(24)))

    # Second user bubble
    ub2_y = ai_y + ai_h + s(36)
    ub2_h = s(96)
    d.rounded_rectangle(
        [(sx + s(40), ub2_y), (sx + sw - s(40), ub2_y + ub2_h)],
        radius=s(28), fill=GREEN_PALE,
    )
    d.text((sx + s(64), ub2_y + s(30)),
           "What was my net worth?",
           fill=DARK, font=reg(s(30)))

    # AI bubble 2
    ai2_y = ub2_y + ub2_h + s(36)
    ai2_h = s(170)
    d.rounded_rectangle(
        [(sx + s(40), ai2_y), (sx + sw - s(40), ai2_y + ai2_h)],
        radius=s(28), fill=GREEN,
    )
    d.text((sx + s(64), ai2_y + s(28)),
           "₹1,82,450",
           fill=WHITE, font=bold(s(40)))
    d.text((sx + s(64), ai2_y + s(82)),
           "Across 3 accounts.",
           fill=WHITE, font=reg(s(28)))
    d.text((sx + s(64), ai2_y + s(124)),
           "+ ₹12,300 vs. last month",
           fill=(200, 230, 210), font=reg(s(24)))

    # Suggestion chips
    sug_y = ai2_y + ai2_h + s(28)
    chip_h = s(72)
    d.rounded_rectangle(
        [(sx + s(40), sug_y), (sx + s(380), sug_y + chip_h)],
        radius=s(36), fill=LIGHT_GREY,
    )
    d.text((sx + s(72), sug_y + s(20)),
           "Show this week",
           fill=DARK, font=reg(s(24)))
    d.rounded_rectangle(
        [(sx + s(400), sug_y), (sx + sw - s(40), sug_y + chip_h)],
        radius=s(36), fill=LIGHT_GREY,
    )
    d.text((sx + s(432), sug_y + s(20)),
           "How much can I invest?",
           fill=DARK, font=reg(s(22)))

    # Quick stats card to fill mid-screen — looks like a system-suggested
    # insight that appears between exchanges in a real chat.
    stats_y = sug_y + chip_h + s(40)
    d.rounded_rectangle(
        [(sx + s(40), stats_y), (sx + sw - s(40), stats_y + s(180))],
        radius=s(20), fill=GREEN_VPALE,
    )
    d.text((sx + s(64), stats_y + s(20)),
           "This week so far", fill=GREY, font=reg(s(22)))
    d.text((sx + s(64), stats_y + s(50)),
           "₹8,420 spent · 14 transactions",
           fill=DARK, font=bold(s(28)))
    d.text((sx + s(64), stats_y + s(100)),
           "+ Food up 12% vs. last week",
           fill=GREY, font=reg(s(22)))
    d.text((sx + s(64), stats_y + s(132)),
           "+ 3 new recurring charges spotted",
           fill=GREY, font=reg(s(22)))

    # Input bar — pinned to the bottom of the screen
    bar_h = s(92)
    bar_y = sy + sh - bar_h - s(28)
    d.rounded_rectangle(
        [(sx + s(40), bar_y), (sx + sw - s(40), bar_y + bar_h)],
        radius=bar_h // 2, fill=LIGHT_GREY,
    )
    d.text((sx + s(70), bar_y + s(28)),
           "Ask anything…", fill=GREY, font=reg(s(26)))
    # Send / mic circle
    btn_d = bar_h - s(20)
    btn_x = sx + sw - s(40) - btn_d - s(12)
    btn_y = bar_y + s(10)
    d.ellipse(
        [(btn_x, btn_y), (btn_x + btn_d, btn_y + btn_d)],
        fill=GREEN,
    )
    arrow = ">"
    aw, ah = tsize(d, arrow, bold(s(40)))
    d.text((btn_x + (btn_d - aw) // 2, btn_y + (btn_d - ah) // 2 - 6),
           arrow, fill=WHITE, font=bold(s(40)))


def screen_inbox(img, layout):
    d = ImageDraw.Draw(img)
    sx, sy, sw, sh = draw_phone_frame(img, layout)
    status_bar(d, sx, sy, sw, layout)
    s = layout.s
    sy += s(56)

    d.text((sx + s(40), sy + s(96)),
           "Pending Review", fill=DARK, font=bold(s(46)))
    rt = "8 ready"
    rt_w, _ = tsize(d, rt, bold(s(30)))
    d.text((sx + sw - s(40) - rt_w, sy + s(112)),
           rt, fill=GREEN_LIGHT, font=bold(s(30)))

    items = [
        ("HDFC Bank",  "Salary credit",        "+₹85,000",  GREEN_LIGHT),
        ("Netflix",    "OTT — recurring",      "−₹649",     RED),
        ("Swiggy",     "Food",                 "−₹420",     RED),
        ("HDFC Card",  "EMI — auto-debit",     "−₹4,250",   RED),
        ("ICICI Bank", "UPI to Akshay",        "−₹2,000",   RED),
        ("Amazon",     "Shopping",             "−₹1,899",   RED),
        ("Uber",       "Transport",            "−₹248",     RED),
        ("Zerodha",    "Mutual fund SIP",      "−₹5,000",   RED),
    ]
    rowy = sy + s(190)
    rowh = s(120)
    for who, what, amt, col in items:
        d.line([(sx + s(40), rowy),
                (sx + sw - s(40), rowy)],
               fill=LIGHT_GREY, width=2)
        # Avatar circle
        ax, ay = sx + s(60), rowy + s(24)
        ar = s(28)
        d.ellipse([(ax, ay), (ax + ar * 2, ay + ar * 2)],
                  fill=GREEN_PALE)
        bw, bh = tsize(d, who[0], bold(s(28)))
        d.text((ax + ar - bw // 2, ay + ar - bh),
               who[0], fill=GREEN, font=bold(s(28)))
        d.text((sx + s(140), rowy + s(22)),
               who, fill=DARK, font=bold(s(28)))
        d.text((sx + s(140), rowy + s(60)),
               what, fill=GREY, font=reg(s(22)))
        amt_w, _ = tsize(d, amt, bold(s(30)))
        d.text((sx + sw - s(40) - amt_w, rowy + s(34)),
               amt, fill=col, font=bold(s(30)))
        rowy += rowh

    # Approve all CTA pinned to the bottom of the inner screen
    cta_h = s(96)
    cta_y = sy + sh - cta_h - s(32)
    d.rounded_rectangle(
        [(sx + s(40), cta_y), (sx + sw - s(40), cta_y + cta_h)],
        radius=s(20), fill=GREEN,
    )
    cap = "Approve all 8 entries"
    cw, ch = tsize(d, cap, bold(s(32)))
    d.text((sx + (sw - cw) // 2, cta_y + s(28)),
           cap, fill=WHITE, font=bold(s(32)))


def screen_recurring(img, layout):
    d = ImageDraw.Draw(img)
    sx, sy, sw, sh = draw_phone_frame(img, layout)
    status_bar(d, sx, sy, sw, layout)
    s = layout.s
    sy += s(56)

    d.text((sx + s(40), sy + s(96)),
           "Recurring Charges", fill=DARK, font=bold(s(44)))
    d.text((sx + s(40), sy + s(160)),
           "Next 30 days · ₹14,200", fill=GREY, font=reg(s(28)))

    items = [
        ("Netflix",          "Premium · 6 May",   "₹649"),
        ("HDFC Card EMI",    "iPhone · 8 May",    "₹4,250"),
        ("LIC Premium",      "Annual · 11 May",   "₹18,000"),
        ("Spotify Family",   "Monthly · 14 May",  "₹179"),
        ("Cult.Fit",         "Monthly · 17 May",  "₹2,500"),
        ("Hotstar",          "Annual · 22 May",   "₹1,499"),
        ("Zerodha SIP",      "Monthly · 25 May",  "₹5,000"),
        ("HDFC Life",        "Quarterly · 28 May", "₹3,800"),
        ("Adobe CC",         "Monthly · 30 May",  "₹1,690"),
    ]
    rowy = sy + s(220)
    cardh = s(96)
    for who, what, amt in items:
        d.rounded_rectangle(
            [(sx + s(40), rowy),
             (sx + sw - s(40), rowy + cardh)],
            radius=s(18), fill=GREEN_VPALE,
        )
        d.text((sx + s(64), rowy + s(18)),
               who, fill=DARK, font=bold(s(28)))
        d.text((sx + s(64), rowy + s(56)),
               what, fill=GREY, font=reg(s(22)))
        aw, _ = tsize(d, amt, bold(s(30)))
        d.text((sx + sw - s(64) - aw, rowy + s(32)),
               amt, fill=GREEN, font=bold(s(30)))
        rowy += cardh + s(14)


def screen_dashboard(img, layout):
    d = ImageDraw.Draw(img)
    sx, sy, sw, sh = draw_phone_frame(img, layout)
    status_bar(d, sx, sy, sw, layout)
    s = layout.s
    sy += s(56)

    d.text((sx + s(40), sy + s(96)),
           "Dashboard", fill=DARK, font=bold(s(54)))

    # Net worth card
    nw_h = s(180)
    d.rounded_rectangle(
        [(sx + s(40), sy + s(180)),
         (sx + sw - s(40), sy + s(180) + nw_h)],
        radius=s(24), fill=GREEN,
    )
    d.text((sx + s(64), sy + s(204)),
           "Net Worth", fill=(200, 230, 210), font=reg(s(28)))
    d.text((sx + s(64), sy + s(244)),
           "₹1,82,450", fill=WHITE, font=bold(s(72)))
    d.text((sx + s(64), sy + s(322)),
           "+ ₹12,300 this month", fill=(220, 240, 230), font=reg(s(24)))

    # Two pill cards: income / expense
    pcy = sy + s(390)
    pch = s(150)
    pcw_left  = (sw - s(120)) // 2
    pcw_right = (sw - s(120)) // 2
    d.rounded_rectangle(
        [(sx + s(40), pcy),
         (sx + s(40) + pcw_left, pcy + pch)],
        radius=s(20), fill=GREEN_VPALE,
    )
    d.text((sx + s(64), pcy + s(20)),
           "Income (May)", fill=GREY, font=reg(s(24)))
    d.text((sx + s(64), pcy + s(56)),
           "₹1,20,000", fill=GREEN, font=bold(s(38)))

    rx = sx + sw - s(40) - pcw_right
    d.rounded_rectangle(
        [(rx, pcy), (rx + pcw_right, pcy + pch)],
        radius=s(20), fill=RED_BG,
    )
    d.text((rx + s(24), pcy + s(20)),
           "Expenses (May)", fill=GREY, font=reg(s(24)))
    d.text((rx + s(24), pcy + s(56)),
           "₹70,840", fill=RED, font=bold(s(38)))

    # Cash flow projection card
    cy = pcy + pch + s(30)
    ch = s(240)
    d.rounded_rectangle(
        [(sx + s(40), cy),
         (sx + sw - s(40), cy + ch)],
        radius=s(20), fill=LIGHT_GREY,
    )
    d.text((sx + s(64), cy + s(20)),
           "June Projection", fill=DARK, font=bold(s(32)))
    d.text((sx + s(64), cy + s(66)),
           "Upcoming outflows next month",
           fill=GREY, font=reg(s(24)))
    d.text((sx + s(64), cy + s(120)),
           "₹62,800", fill=GREEN, font=bold(s(54)))
    d.text((sx + s(64), cy + s(190)),
           "EMIs ₹16,400 · OTT ₹1,827 · Insurance ₹18k",
           fill=GREY, font=reg(s(22)))

    # Top categories breakdown — fills the bottom of the screen
    by = cy + ch + s(40)
    d.text((sx + s(40), by),
           "Top Categories — May", fill=DARK, font=bold(s(30)))
    by += s(60)
    cats = [
        ("Food & Dining",   "₹14,820", 0.78, GREEN),
        ("Transport",       "₹6,210",  0.46, GREEN_LIGHT),
        ("Subscriptions",   "₹4,827",  0.38, (155, 100, 200)),
        ("Shopping",        "₹3,540",  0.27, (220, 140, 80)),
    ]
    for label, amt, frac, col in cats:
        d.text((sx + s(40), by),
               label, fill=DARK, font=reg(s(24)))
        aw, _ = tsize(d, amt, bold(s(26)))
        d.text((sx + sw - s(40) - aw, by - s(2)),
               amt, fill=DARK, font=bold(s(26)))
        # bar
        bar_y = by + s(38)
        bar_x0 = sx + s(40)
        bar_x1 = sx + sw - s(40)
        bar_h = s(10)
        d.rounded_rectangle(
            [(bar_x0, bar_y), (bar_x1, bar_y + bar_h)],
            radius=bar_h // 2, fill=LIGHT_GREY,
        )
        fill_x1 = bar_x0 + int((bar_x1 - bar_x0) * frac)
        d.rounded_rectangle(
            [(bar_x0, bar_y), (fill_x1, bar_y + bar_h)],
            radius=bar_h // 2, fill=col,
        )
        by += s(80)


def screen_invoice(img, layout):
    d = ImageDraw.Draw(img)
    sx, sy, sw, sh = draw_phone_frame(img, layout)
    status_bar(d, sx, sy, sw, layout)
    s = layout.s
    sy += s(56)

    d.text((sx + s(40), sy + s(96)),
           "Invoice #2026-014", fill=DARK, font=bold(s(38)))
    d.text((sx + s(40), sy + s(150)),
           "To: Acme Pvt Ltd", fill=GREY, font=reg(s(26)))

    rowy = sy + s(220)
    for label, qty, amt in [
        ("Web design — May 2026", "1", "60,000.00"),
        ("Logo refresh",           "1", "15,000.00"),
        ("Hosting (annual)",       "1",  "8,400.00"),
    ]:
        d.text((sx + s(40), rowy), label, fill=DARK, font=reg(s(26)))
        d.text((sx + s(620), rowy), qty, fill=GREY, font=reg(s(26)))
        amt_str = f"₹ {amt}"
        aw, _ = tsize(d, amt_str, reg(s(26)))
        d.text((sx + sw - s(40) - aw, rowy),
               amt_str, fill=DARK, font=reg(s(26)))
        rowy += s(54)

    rowy += s(28)
    d.line([(sx + s(40), rowy),
            (sx + sw - s(40), rowy)],
           fill=LIGHT_GREY, width=2)
    rowy += s(20)
    for label, amt in [
        ("Subtotal", "83,400.00"),
        ("CGST 9%",   "7,506.00"),
        ("SGST 9%",   "7,506.00"),
    ]:
        d.text((sx + s(40), rowy), label, fill=GREY, font=reg(s(24)))
        amt_str = f"₹ {amt}"
        aw, _ = tsize(d, amt_str, reg(s(26)))
        d.text((sx + sw - s(40) - aw, rowy),
               amt_str, fill=DARK, font=reg(s(26)))
        rowy += s(50)

    rowy += s(16)
    th = s(96)
    d.rounded_rectangle(
        [(sx + s(40), rowy),
         (sx + sw - s(40), rowy + th)],
        radius=s(14), fill=GREEN,
    )
    d.text((sx + s(64), rowy + s(30)),
           "Total", fill=WHITE, font=bold(s(32)))
    total_str = "₹ 98,412.00"
    tw, _ = tsize(d, total_str, bold(s(36)))
    d.text((sx + sw - s(64) - tw, rowy + s(28)),
           total_str, fill=WHITE, font=bold(s(36)))

    rowy += th + s(28)
    bh = s(98)
    d.rounded_rectangle(
        [(sx + s(40), rowy),
         (sx + sw - s(40), rowy + bh)],
        radius=s(20), fill=GREEN_LIGHT,
    )
    cap = "Email to client"
    cw, ch = tsize(d, cap, bold(s(34)))
    d.text((sx + (sw - cw) // 2, rowy + s(28)),
           cap, fill=WHITE, font=bold(s(34)))
    rowy += bh + s(40)

    # Recent invoices list — fills the bottom of the screen
    d.text((sx + s(40), rowy),
           "Recent", fill=DARK, font=bold(s(28)))
    rowy += s(50)
    recent = [
        ("#2026-013 · TechCorp Pvt Ltd",   "Paid",   "₹ 1,24,000", GREEN),
        ("#2026-012 · DesignLab",          "Paid",   "₹ 38,500",   GREEN),
        ("#2026-011 · Bright Studio",      "Pending", "₹ 22,000",  GREY),
        ("#2026-010 · Acme Pvt Ltd",       "Paid",   "₹ 67,200",   GREEN),
    ]
    for ref, status, amt, col in recent:
        d.text((sx + s(40), rowy), ref, fill=DARK, font=reg(s(22)))
        d.text((sx + s(40), rowy + s(28)), status, fill=col, font=reg(s(20)))
        aw, _ = tsize(d, amt, bold(s(24)))
        d.text((sx + sw - s(40) - aw, rowy + s(8)),
               amt, fill=DARK, font=bold(s(24)))
        rowy += s(70)


def screen_pricing(img, layout):
    d = ImageDraw.Draw(img)
    sx, sy, sw, sh = draw_phone_frame(img, layout)
    status_bar(d, sx, sy, sw, layout)
    s = layout.s
    sy += s(56)

    d.text((sx + s(40), sy + s(96)),
           "Choose a plan", fill=DARK, font=bold(s(46)))
    plans = [
        ("Monthly",   "₹199 / month",       "Flexible",                       False),
        ("Quarterly", "₹449 / 3 months",    "Save 25%",                       False),
        ("Yearly",    "₹1,499 / year",      "Save 37% — most popular",        True),
        ("Lifetime",  "₹4,999 one-time",    "Pay once, use forever",          False),
    ]
    rowy = sy + s(190)
    cardh = s(150)
    for name, price, sub, popular in plans:
        bg = GREEN if popular else GREEN_VPALE
        fg = WHITE if popular else DARK
        sub_fg = (220, 240, 230) if popular else GREY
        d.rounded_rectangle(
            [(sx + s(40), rowy),
             (sx + sw - s(40), rowy + cardh)],
            radius=s(22), fill=bg,
        )
        d.text((sx + s(64), rowy + s(22)),
               name, fill=fg, font=bold(s(34)))
        d.text((sx + s(64), rowy + s(70)),
               price, fill=fg, font=bold(s(30)))
        d.text((sx + s(64), rowy + s(110)),
               sub, fill=sub_fg, font=reg(s(24)))
        if popular:
            badge_w = s(160)
            badge_h = s(46)
            badge_x = sx + sw - s(64) - badge_w
            d.rounded_rectangle(
                [(badge_x, rowy + s(26)),
                 (badge_x + badge_w, rowy + s(26) + badge_h)],
                radius=s(22), fill=WHITE,
            )
            t = "Popular"
            tw, _ = tsize(d, t, bold(s(24)))
            d.text((badge_x + (badge_w - tw) // 2,
                    rowy + s(26) + (badge_h - s(24)) // 2 - 2),
                   t, fill=GREEN, font=bold(s(24)))
        rowy += cardh + s(20)

    # Promo code field
    py = rowy + s(20)
    d.rounded_rectangle(
        [(sx + s(40), py), (sx + sw - s(40), py + s(96))],
        radius=s(20), outline=GREEN_LIGHT, width=2,
    )
    d.text((sx + s(64), py + s(28)),
           "Have a promo code?",
           fill=GREY, font=reg(s(26)))
    cap = "Apply"
    cw, _ = tsize(d, cap, bold(s(28)))
    d.text((sx + sw - s(64) - cw, py + s(32)),
           cap, fill=GREEN, font=bold(s(28)))

    # Trust note
    ty = py + s(120)
    note = "7-day free trial · ₹1 today (deducted from first cycle)"
    nw, _ = tsize(d, note, reg(s(22)))
    d.text((sx + (sw - nw) // 2, ty),
           note, fill=GREY, font=reg(s(22)))

    # What's included
    incy = ty + s(60)
    d.text((sx + s(40), incy),
           "Included in every plan", fill=DARK, font=bold(s(30)))
    incy += s(48)
    bullets = [
        "Unlimited AI bookkeeping entries",
        "Auto-import from Gmail + bank SMS",
        "GST-ready invoices + reports",
        "Cancel any time, no CA fees",
    ]
    for b in bullets:
        # Green check disc
        d.ellipse(
            [(sx + s(48), incy + s(6)),
             (sx + s(48) + s(28), incy + s(6) + s(28))],
            fill=GREEN,
        )
        d.text((sx + s(54), incy + s(6) - 2),
               "✓", fill=WHITE, font=bold(s(22)))
        d.text((sx + s(92), incy),
               b, fill=DARK, font=reg(s(26)))
        incy += s(46)


# ───── Driver ──────────────────────────────────────────────────
# Marketing taglines preserved verbatim from the existing App Store
# Connect / Play Store listing — only the editing/layout has changed.
SCREENS = [
    ("01-talk-ai",      "Just Ask. AI Does Everything.",
     "Speak to SpentyAI in plain English — it logs the entry, picks the category, and posts the journal.",
     screen_talk_ai),
    ("02-auto-detect",  "Bank Email Arrives. We Log It Instantly.",
     "Connect Gmail or Outlook. SpentyAI drafts every entry from your inbox. You approve.",
     screen_inbox),
    ("03-recurring",    "See What's Coming. Plan Ahead.",
     "Every NACH, UPI AutoPay, SIP, OTT and EMI surfaced before it hits your account.",
     screen_recurring),
    ("04-dashboard",    "All Your Money. One Clear View.",
     "Net worth, income, expenses, cash flow — everything that matters in a single dashboard.",
     screen_dashboard),
    ("05-invoices",     "Every Rupee. Perfectly Tracked.",
     "GST-ready invoices with CGST, SGST, IGST and HSN — emailed to clients in one tap.",
     screen_invoice),
    ("06-pricing",      "Try free for 7 days.",
     "Plans from ₹199/mo. Cancel any time. No CA fees.",
     screen_pricing),
]

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def render_one(layout, slug, headline, sub, fn):
    img, d = draw_background_and_headline(layout, headline, sub)
    fn(img, layout)
    out_path = os.path.join(
        OUT_DIR, "out", f"{layout.label}_{slug}.png"
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "PNG", optimize=True)
    return out_path


def main():
    targets = [
        Layout(1080, 1920, "android"),    # Play Store phone
        Layout(1284, 2778, "ios65"),      # App Store iPhone 6.5" slot (per Apple's exact spec)
    ]
    for layout in targets:
        for slug, head, sub, fn in SCREENS:
            p = render_one(layout, slug, head, sub, fn)
            print(p)


if __name__ == "__main__":
    main()
