# Builds the default 1200x630 Open Graph fallback PNG for 2yolks
# in the After hours visual identity (plum #211729 + lime #e0fa80 + gold #ffd166).
# Run: python3 scripts/build-og-default.py
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

def pick_font(candidates):
    for p in candidates:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"No font found among {candidates}")

BOLD = pick_font([
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
])
REG = pick_font([
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
])

PLUM = '#211729'
PLUM_ELEV = '#2b1e35'
LIME = '#e0fa80'
GOLD = '#ffd166'
CREAM = '#faf8f3'
MUTED = '#d8cedf'
BORDER = '#65566e'

img = Image.new('RGB', (W, H), PLUM)
d = ImageDraw.Draw(img)

# Outer frame & top lime bar
d.rectangle([28, 28, W - 28, H - 28], outline=BORDER, width=2)
d.rectangle([28, 28, W - 28, 42], fill=LIME)

# Brand row + Twin Yolks geometric mark
f_brand = ImageFont.truetype(BOLD, 54)
d.text((76, 86), '2yolks', font=f_brand, fill=CREAM)
d.ellipse([268, 94, 310, 134], fill=LIME)
d.ellipse([306, 91, 344, 128], fill=GOLD)

# Headline
f_h1 = ImageFont.truetype(BOLD, 68)
d.text((76, 198), 'Small kitchen.', font=f_h1, fill=LIME)
d.text((76, 278), 'Big appetite.', font=f_h1, fill=LIME)

# Subhead
f_sub = ImageFont.truetype(REG, 30)
d.text((76, 384), 'Honest, ad-free recipes in English · Español · Français', font=f_sub, fill=MUTED)

# Footer strip
d.line([(76, 514), (W - 76, 514)], fill=BORDER, width=2)
f_foot = ImageFont.truetype(BOLD, 26)
d.text((76, 536), '2yolks.com', font=f_foot, fill=LIME)
d.text((W - 76, 536), 'Unit scaling · Cook mode · Clear tasting notes', font=ImageFont.truetype(REG, 24), fill=MUTED, anchor='ra')

# Right-side cream badge card
d.rectangle([796, 112, 1124, 464], fill=PLUM_ELEV, outline=BORDER, width=2)
d.rectangle([796, 112, 1124, 122], fill=LIME)
d.text((828, 152), 'RECIPES WITHOUT BORDERS', font=ImageFont.truetype(BOLD, 20), fill=LIME)
for i, (line1, line2) in enumerate([
    ('US & Metric', 'Instant kitchen scaling'),
    ('EN / ES / FR', 'Multilingual & tested labels'),
    ('Zero Clutter', 'Step-by-step Cook Mode'),
]):
    yy = 210 + i * 82
    d.ellipse([828, yy + 6, 844, yy + 22], fill=LIME if i % 2 == 0 else GOLD)
    d.text((860, yy), line1, font=ImageFont.truetype(BOLD, 23), fill=CREAM)
    d.text((860, yy + 28), line2, font=ImageFont.truetype(REG, 19), fill=MUTED)

out_path = os.path.join('packages', 'web', 'public', 'img', 'identity', 'og-default.png')
os.makedirs(os.path.dirname(out_path), exist_ok=True)
img.save(out_path, 'PNG', optimize=True)
print('Wrote', out_path)
