# Builds the title-only Pinterest/share graphics (2:3, no food photo, honest label).
# Run: python3 scripts/build-pin-graphics.py   (needs Pillow; output is committed)
import json, textwrap, os
from PIL import Image, ImageDraw, ImageFont
W, H = 1000, 1500
data = json.load(open('packages/api/content/wave1.json'))
FONT = '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf'
REG = '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'
LABEL = {'en': 'NOT YET TESTED', 'es': 'AÚN NO PROBADA', 'fr': 'PAS ENCORE TESTÉE'}
FOOT = {'en': 'This recipe has not been kitchen-tested by 2yolks.', 'es': 'Esta receta aún no ha sido probada en cocina por 2yolks.', 'fr': "Cette recette n’a pas encore été testée en cuisine par 2yolks."}
COUNTRY = {'us': 'United States', 'mx': 'México'}
for r in data['recipes']:
    img = Image.new('RGB', (W, H), '#fffbf5')
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 24], fill='#c2410c')
    d.text((80, 120), COUNTRY.get(r['country'], r['country']).upper(), font=ImageFont.truetype(FONT, 44), fill='#57534e')
    size = 96
    f = ImageFont.truetype(FONT, size)
    def wrap_px(text, font, maxw):
        out, cur = [], ''
        for w in text.split():
            t = (cur + ' ' + w).strip()
            if d.textlength(t, font=font) <= maxw: cur = t
            else: out.append(cur); cur = w
        out.append(cur); return out
    lines = wrap_px(r['title'], f, W - 240)
    while len(lines) > 5 and size > 60:
        size -= 8; f = ImageFont.truetype(FONT, size); lines = wrap_px(r['title'], f, W - 240)
    y = 300
    for ln in lines:
        d.text((80, y), ln, font=f, fill='#1c1917'); y += int(size * 1.25)
    lab = LABEL.get(r['lang'], 'NOT YET TESTED')
    lf = ImageFont.truetype(FONT, 40)
    tw = d.textlength(lab, font=lf)
    d.rounded_rectangle([80, H - 400, 80 + tw + 64, H - 320], radius=40, fill='#fef3c7', outline='#fcd34d', width=3)
    d.text((112, H - 390), lab, font=lf, fill='#78350f')
    ff = ImageFont.truetype(REG, 34)
    foot = FOOT.get(r['lang'], FOOT['en'])
    # wrap to the safe width (80px margins each side)
    words, cur, rows = foot.split(), '', []
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=ff) <= W - 160: cur = t
        else: rows.append(cur); cur = w
    rows.append(cur)
    for k, row in enumerate(rows): d.text((80, H - 260 + k * 46), row, font=ff, fill='#57534e')
    d.text((80, H - 140), '2yolks.com', font=ImageFont.truetype(FONT, 64), fill='#c2410c')
    img.save(f"packages/web/public/img/pin/{r['id']}.{r['lang']}.png", optimize=True)
    print(r['id'], len(lines), size)
