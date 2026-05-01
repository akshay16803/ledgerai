"""Generate 6 phone screenshot mockups (1080×1920) for Play Store.
Each shows a benefit headline + a stylized phone-frame mock of the actual screen."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1920
BRAND_GREEN = (40, 88, 64)
BRAND_GREEN_LIGHT = (88, 156, 110)
BRAND_GREEN_VERY_LIGHT = (224, 240, 230)
WHITE = (255, 255, 255)
DARK = (24, 32, 28)
GREY = (138, 142, 138)
LIGHT_GREY = (236, 240, 236)

F_LATO_BOLD = "/usr/share/fonts/truetype/lato/Lato-Bold.ttf"
F_LATO_REG = "/usr/share/fonts/truetype/lato/Lato-Regular.ttf"
F_NOTO_BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
F_NOTO_REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
F_DV_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
F_DV_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font_at(path, size):
    try: return ImageFont.truetype(path, size)
    except: return ImageFont.truetype(F_DV_BOLD, size)

def bold(size):
    for f in [F_LATO_BOLD, F_NOTO_BOLD, F_DV_BOLD]:
        if os.path.exists(f): return font_at(f, size)
    return ImageFont.load_default()

def reg(size):
    for f in [F_LATO_REG, F_NOTO_REG, F_DV_REG]:
        if os.path.exists(f): return font_at(f, size)
    return ImageFont.load_default()

def tsize(d, text, f):
    b = d.textbbox((0, 0), text, font=f)
    return b[2] - b[0], b[3] - b[1]

def center_text(d, y, text, f, color=WHITE):
    tw, th = tsize(d, text, f)
    d.text(((W - tw) // 2, y), text, fill=color, font=f)
    return th

def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        tw, _ = tsize(draw, trial, font)
        if tw <= max_width:
            cur = trial
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def base_canvas(headline, subhead, body_color=BRAND_GREEN):
    """Return (img, draw, body_top_y) — top half is brand green with headline/subhead, bottom half is for the device mock."""
    img = Image.new("RGB", (W, H), body_color)
    d = ImageDraw.Draw(img)
    # Headline
    head_font = bold(82)
    sub_font = reg(46)
    # Wrap headline
    lines = wrap_text(headline, head_font, W - 120, d)
    y = 130
    for line in lines:
        center_text(d, y, line, head_font, WHITE)
        y += 100
    y += 24
    # Sub
    sub_lines = wrap_text(subhead, sub_font, W - 160, d)
    for line in sub_lines:
        center_text(d, y, line, sub_font, (220, 240, 230))
        y += 60
    return img, d, y + 80

def draw_phone_frame(img, x, y, w, h):
    """Rounded white phone-frame at (x,y) of size (w,h)."""
    d = ImageDraw.Draw(img)
    # Frame shadow (subtle dark below)
    d.rounded_rectangle([(x - 12, y + 12), (x + w + 12, y + h + 12)],
                        radius=70, fill=(20, 50, 36))
    # Phone frame
    d.rounded_rectangle([(x, y), (x + w, y + h)], radius=64, fill=DARK)
    # Inner screen
    sx, sy = x + 24, y + 24
    sw, sh = w - 48, h - 48
    d.rounded_rectangle([(sx, sy), (sx + sw, sy + sh)], radius=40, fill=WHITE)
    return sx, sy, sw, sh

def status_bar(d, sx, sy, sw):
    """Small grey status bar"""
    f = bold(28)
    d.text((sx + 32, sy + 18), "9:41", fill=DARK, font=f)
    d.text((sx + sw - 110, sy + 18), "100%", fill=DARK, font=reg(24))

# ===== Screenshot 1: Onboarding "Talk to AI" =====
def s1_talk_ai():
    img, d, y = base_canvas(
        "Talk to your finances.",
        "AI logs every expense, picks the right category, posts the journal."
    )
    # Phone mock
    px, py = 140, 920
    pw, ph = 800, 880
    sx, sy, sw, sh = draw_phone_frame(img, px, py, pw, ph)
    status_bar(d, sx, sy, sw)
    # Chat bubble (user)
    user_bubble_y = sy + 100
    d.rounded_rectangle([(sx + 40, user_bubble_y), (sx + sw - 40, user_bubble_y + 120)],
                        radius=24, fill=BRAND_GREEN_VERY_LIGHT)
    d.text((sx + 60, user_bubble_y + 28), "I spent ₹500 on lunch from", fill=DARK, font=reg(28))
    d.text((sx + 60, user_bubble_y + 64), "HDFC card", fill=DARK, font=reg(28))
    # AI response
    ai_bubble_y = user_bubble_y + 160
    d.rounded_rectangle([(sx + 40, ai_bubble_y), (sx + sw - 40, ai_bubble_y + 240)],
                        radius=24, fill=BRAND_GREEN)
    d.text((sx + 60, ai_bubble_y + 24), "Logged ₹500 to Food", fill=WHITE, font=bold(30))
    d.text((sx + 60, ai_bubble_y + 64), "category, HDFC card.", fill=WHITE, font=reg(28))
    d.text((sx + 60, ai_bubble_y + 110), "Total food this month:", fill=(200, 230, 210), font=reg(24))
    d.text((sx + 60, ai_bubble_y + 142), "₹4,290 (Budget ₹6,000)", fill=WHITE, font=bold(26))
    d.text((sx + 60, ai_bubble_y + 188), "Tap to approve.", fill=(180, 220, 200), font=reg(22))
    # Quick suggestions
    sugg_y = ai_bubble_y + 290
    d.rounded_rectangle([(sx + 40, sugg_y), (sx + 360, sugg_y + 64)], radius=32, fill=LIGHT_GREY)
    d.text((sx + 70, sugg_y + 16), "Net worth?", fill=DARK, font=reg(24))
    d.rounded_rectangle([(sx + 380, sugg_y), (sx + sw - 40, sugg_y + 64)], radius=32, fill=LIGHT_GREY)
    d.text((sx + 410, sugg_y + 16), "How much did I save?", fill=DARK, font=reg(22))
    img.save("screenshot-1-talk-ai.png")
    print("screenshot-1-talk-ai.png saved")

# ===== Screenshot 2: Auto-detect from inbox =====
def s2_auto_detect():
    img, d, y = base_canvas(
        "Found in your inbox.",
        "Connect Gmail or Outlook. We draft every entry. You approve."
    )
    px, py = 140, 920
    pw, ph = 800, 880
    sx, sy, sw, sh = draw_phone_frame(img, px, py, pw, ph)
    status_bar(d, sx, sy, sw)
    title = bold(40)
    d.text((sx + 40, sy + 80), "Pending Review", fill=DARK, font=title)
    d.text((sx + sw - 200, sy + 90), "8 ready", fill=BRAND_GREEN_LIGHT, font=bold(28))

    # 5 transaction rows
    items = [
        ("HDFC Bank", "Salary credit", "₹85,000", "+", BRAND_GREEN_LIGHT),
        ("Netflix", "OTT — recurring", "₹649", "−", (200, 110, 110)),
        ("Swiggy", "Food", "₹420", "−", (200, 110, 110)),
        ("HDFC Card", "EMI — auto-debit", "₹4,250", "−", (200, 110, 110)),
        ("ICICI Bank", "UPI to Akshay", "₹2,000", "−", (200, 110, 110)),
    ]
    rowy = sy + 170
    for who, what, amt, sgn, col in items:
        d.line([(sx + 40, rowy), (sx + sw - 40, rowy)], fill=LIGHT_GREY, width=2)
        d.ellipse([(sx + 60, rowy + 28), (sx + 110, rowy + 78)], fill=BRAND_GREEN_VERY_LIGHT)
        d.text((sx + 75, rowy + 38), who[0], fill=BRAND_GREEN, font=bold(28))
        d.text((sx + 130, rowy + 24), who, fill=DARK, font=bold(28))
        d.text((sx + 130, rowy + 60), what, fill=GREY, font=reg(22))
        d.text((sx + sw - 230, rowy + 30), f"{sgn}{amt}", fill=col, font=bold(30))
        d.text((sx + sw - 130, rowy + 70), "Approve →", fill=BRAND_GREEN, font=bold(20))
        rowy += 130
    img.save("screenshot-2-auto-detect.png")
    print("screenshot-2-auto-detect.png saved")

# ===== Screenshot 3: Subscriptions / Mandates =====
def s3_subscriptions():
    img, d, y = base_canvas(
        "Find every auto-debit.",
        "NACH, UPI AutoPay, SIPs, OTT, EMIs — surface them all."
    )
    px, py = 140, 920
    pw, ph = 800, 880
    sx, sy, sw, sh = draw_phone_frame(img, px, py, pw, ph)
    status_bar(d, sx, sy, sw)
    d.text((sx + 40, sy + 80), "Recurring Charges", fill=DARK, font=bold(40))
    d.text((sx + 40, sy + 138), "Next 30 days · ₹14,200", fill=GREY, font=reg(26))
    items = [
        ("Netflix", "Premium · 6 May", "₹649", BRAND_GREEN),
        ("HDFC Card EMI", "iPhone · 8 May", "₹4,250", BRAND_GREEN),
        ("LIC Premium", "Annual · 11 May", "₹18,000", BRAND_GREEN),
        ("Spotify Family", "Monthly · 14 May", "₹179", BRAND_GREEN),
        ("Cult.Fit", "Monthly · 17 May", "₹2,500", BRAND_GREEN),
        ("Hotstar", "Annual · 22 May", "₹1,499", BRAND_GREEN),
    ]
    rowy = sy + 200
    for who, what, amt, col in items:
        d.rounded_rectangle([(sx + 40, rowy), (sx + sw - 40, rowy + 92)], radius=18, fill=BRAND_GREEN_VERY_LIGHT)
        d.text((sx + 64, rowy + 18), who, fill=DARK, font=bold(28))
        d.text((sx + 64, rowy + 54), what, fill=GREY, font=reg(22))
        d.text((sx + sw - 200, rowy + 34), amt, fill=col, font=bold(30))
        rowy += 110
    img.save("screenshot-3-subscriptions.png")
    print("screenshot-3-subscriptions.png saved")

# ===== Screenshot 4: Dashboard =====
def s4_dashboard():
    img, d, y = base_canvas(
        "Your money, all in one.",
        "Net worth, cash flow, accounts — everything that matters, instantly."
    )
    px, py = 140, 920
    pw, ph = 800, 880
    sx, sy, sw, sh = draw_phone_frame(img, px, py, pw, ph)
    status_bar(d, sx, sy, sw)
    d.text((sx + 40, sy + 80), "Dashboard", fill=DARK, font=bold(48))
    # Big stat
    d.rounded_rectangle([(sx + 40, sy + 160), (sx + sw - 40, sy + 320)], radius=24, fill=BRAND_GREEN)
    d.text((sx + 64, sy + 184), "Net Worth", fill=(200, 230, 210), font=reg(26))
    d.text((sx + 64, sy + 220), "₹1,82,450", fill=WHITE, font=bold(64))
    d.text((sx + 64, sy + 290), "↑ ₹12,300 this month", fill=(220, 240, 230), font=reg(22))
    # Two small cards
    d.rounded_rectangle([(sx + 40, sy + 350), (sx + 410, sy + 480)], radius=20, fill=BRAND_GREEN_VERY_LIGHT)
    d.text((sx + 64, sy + 370), "Income (May)", fill=GREY, font=reg(22))
    d.text((sx + 64, sy + 400), "₹1,20,000", fill=BRAND_GREEN, font=bold(38))
    d.rounded_rectangle([(sx + 430, sy + 350), (sx + sw - 40, sy + 480)], radius=20, fill=(248, 232, 232))
    d.text((sx + 454, sy + 370), "Expenses (May)", fill=GREY, font=reg(22))
    d.text((sx + 454, sy + 400), "₹70,840", fill=(180, 80, 80), font=bold(38))
    # Cashflow card
    d.rounded_rectangle([(sx + 40, sy + 510), (sx + sw - 40, sy + 720)], radius=20, fill=LIGHT_GREY)
    d.text((sx + 64, sy + 530), "June Projection", fill=DARK, font=bold(30))
    d.text((sx + 64, sy + 568), "Upcoming outflows next month", fill=GREY, font=reg(22))
    d.text((sx + 64, sy + 624), "₹62,800", fill=BRAND_GREEN, font=bold(48))
    d.text((sx + 64, sy + 686), "EMIs ₹16,400 · OTT ₹1,827 · Insurance ₹18,000", fill=GREY, font=reg(20))
    img.save("screenshot-4-dashboard.png")
    print("screenshot-4-dashboard.png saved")

# ===== Screenshot 5: GST invoices =====
def s5_invoices():
    img, d, y = base_canvas(
        "GST invoices in seconds.",
        "CGST, SGST, IGST, HSN — sent to clients in one tap."
    )
    px, py = 140, 920
    pw, ph = 800, 880
    sx, sy, sw, sh = draw_phone_frame(img, px, py, pw, ph)
    status_bar(d, sx, sy, sw)
    d.text((sx + 40, sy + 80), "Invoice #2026-014", fill=DARK, font=bold(36))
    d.text((sx + 40, sy + 130), "To: Acme Pvt Ltd", fill=GREY, font=reg(24))
    # Bill items
    rowy = sy + 200
    for label, qty, amt in [("Web design — May 2026", "1", "60,000.00"),
                             ("Logo refresh", "1", "15,000.00"),
                             ("Hosting (annual)", "1", "8,400.00")]:
        d.text((sx + 40, rowy), label, fill=DARK, font=reg(24))
        d.text((sx + 600, rowy), qty, fill=GREY, font=reg(24))
        d.text((sx + sw - 220, rowy), f"₹ {amt}", fill=DARK, font=reg(24))
        rowy += 50
    # Tax breakdown
    rowy += 30
    d.line([(sx + 40, rowy), (sx + sw - 40, rowy)], fill=LIGHT_GREY, width=2)
    rowy += 20
    for label, amt in [("Subtotal", "83,400.00"),
                       ("CGST 9%", "7,506.00"),
                       ("SGST 9%", "7,506.00")]:
        d.text((sx + 40, rowy), label, fill=GREY, font=reg(22))
        d.text((sx + sw - 220, rowy), f"₹ {amt}", fill=DARK, font=reg(24))
        rowy += 44
    rowy += 10
    d.rounded_rectangle([(sx + 40, rowy), (sx + sw - 40, rowy + 80)], radius=12, fill=BRAND_GREEN)
    d.text((sx + 64, rowy + 26), "Total", fill=WHITE, font=bold(28))
    d.text((sx + sw - 270, rowy + 22), "₹ 98,412.00", fill=WHITE, font=bold(32))
    rowy += 110
    # Send button
    d.rounded_rectangle([(sx + 40, rowy), (sx + sw - 40, rowy + 84)], radius=18, fill=BRAND_GREEN_LIGHT)
    cx, cy = sx + sw // 2, rowy + 24
    txt = "Email to client →"
    f = bold(30)
    tw, th = tsize(d, txt, f)
    d.text((cx - tw // 2, cy + 8), txt, fill=WHITE, font=f)
    img.save("screenshot-5-invoices.png")
    print("screenshot-5-invoices.png saved")

# ===== Screenshot 6: Try Free — pricing =====
def s6_pricing():
    img, d, y = base_canvas(
        "Try free for 7 days.",
        "Plans from ₹199/mo. Cancel any time. No CA fees."
    )
    px, py = 140, 920
    pw, ph = 800, 880
    sx, sy, sw, sh = draw_phone_frame(img, px, py, pw, ph)
    status_bar(d, sx, sy, sw)
    d.text((sx + 40, sy + 80), "Choose a plan", fill=DARK, font=bold(40))
    plans = [
        ("Monthly", "₹199 / month", "Flexible", False),
        ("Quarterly", "₹449 / 3 months", "Save 25%", False),
        ("Yearly", "₹1,499 / year", "Save 37% — most popular", True),
        ("Lifetime", "₹4,999 one-time", "Pay once, use forever", False),
    ]
    rowy = sy + 160
    for name, price, sub, popular in plans:
        bg = BRAND_GREEN if popular else BRAND_GREEN_VERY_LIGHT
        fg = WHITE if popular else DARK
        sub_fg = (220, 240, 230) if popular else GREY
        d.rounded_rectangle([(sx + 40, rowy), (sx + sw - 40, rowy + 130)], radius=20, fill=bg)
        d.text((sx + 64, rowy + 22), name, fill=fg, font=bold(32))
        d.text((sx + 64, rowy + 64), price, fill=fg, font=bold(28))
        d.text((sx + 64, rowy + 100), sub, fill=sub_fg, font=reg(22))
        if popular:
            badge_w = 140
            badge_x = sx + sw - 60 - badge_w
            d.rounded_rectangle([(badge_x, rowy + 24), (badge_x + badge_w, rowy + 60)], radius=18, fill=WHITE)
            d.text((badge_x + 30, rowy + 30), "Popular", fill=BRAND_GREEN, font=bold(22))
        rowy += 145
    img.save("screenshot-6-pricing.png")
    print("screenshot-6-pricing.png saved")

s1_talk_ai()
s2_auto_detect()
s3_subscriptions()
s4_dashboard()
s5_invoices()
s6_pricing()
