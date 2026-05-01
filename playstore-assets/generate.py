from PIL import Image, ImageDraw, ImageFont
import os

# SpentyAI brand: dark green primary
BRAND_GREEN = (40, 88, 64)        # deep brand green
BRAND_GREEN_LIGHT = (88, 156, 110) # accent
BRAND_GREEN_VERY_LIGHT = (224, 240, 230)
WHITE = (255, 255, 255)
DARK = (24, 32, 28)
GREY = (138, 142, 138)

# Fonts
F_LATO_BOLD = "/usr/share/fonts/truetype/lato/Lato-Bold.ttf"
F_LATO_REG = "/usr/share/fonts/truetype/lato/Lato-Regular.ttf"
F_NOTO_BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
F_NOTO_REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
F_DV_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
F_DV_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.truetype(F_DV_BOLD, size)

def use_bold(size):
    for f in [F_LATO_BOLD, F_NOTO_BOLD, F_DV_BOLD]:
        if os.path.exists(f):
            return font(f, size)
    return ImageFont.load_default()

def use_reg(size):
    for f in [F_LATO_REG, F_NOTO_REG, F_DV_REG]:
        if os.path.exists(f):
            return font(f, size)
    return ImageFont.load_default()

def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

# ----- 1. App icon (512×512) -----
icon = Image.new("RGBA", (512, 512), BRAND_GREEN)
d = ImageDraw.Draw(icon)
# Add subtle gradient/circle
# Inner circle for depth
d.ellipse([(96, 96), (416, 416)], fill=(56, 116, 84))
# Big bold S in middle
S_FONT = use_bold(360)
tw, th = text_size(d, "S", S_FONT)
d.text(((512 - tw) // 2, (512 - th) // 2 - 30), "S", fill=WHITE, font=S_FONT)
# Small "AI" sub-mark bottom
ai_font = use_bold(56)
ai_w, ai_h = text_size(d, "AI", ai_font)
d.text(((512 - ai_w) // 2, 380), "AI", fill=WHITE, font=ai_font)
icon.save("icon-512.png")
print("icon-512.png saved")

# ----- 2. Feature graphic (1024×500) -----
fg = Image.new("RGB", (1024, 500), BRAND_GREEN)
d = ImageDraw.Draw(fg)
# Decorative right side
d.ellipse([(700, -100), (1200, 600)], fill=(56, 116, 84))
# App name big
title_font = use_bold(96)
d.text((60, 140), "SpentyAI", fill=WHITE, font=title_font)
# Subtitle
sub_font = use_reg(40)
d.text((60, 250), "AI Accountant for India", fill=(220, 240, 230), font=sub_font)
# Mini features
feat_font = use_reg(28)
d.text((60, 340), "Track UPI · Find auto-debits · GST invoices", fill=(200, 230, 210), font=feat_font)
# Get Started badge
badge_font = use_bold(24)
d.rectangle([(60, 400), (320, 460)], fill=WHITE, outline=None)
d.text((90, 415), "Try Free for 7 Days", fill=BRAND_GREEN, font=badge_font)
fg.save("feature-graphic-1024x500.png")
print("feature-graphic-1024x500.png saved")

print("Done")
