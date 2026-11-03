# Builds the title-only Pinterest/share graphics (2:3, no food photo, honest label)
# in the After hours visual identity (plum #211729 + lime #e0fa80).
# Run: python3 scripts/build-pin-graphics.py   (needs Pillow; output is committed)
import json, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1000, 1500
data = json.load(open('packages/api/content/wave1.json'))

def pick_font(candidates):
    for p in candidates:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"No font found among {candidates}")

FONT = pick_font([
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
])
REG = pick_font([
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
])

LABEL = {'en': 'NOT YET TESTED', 'es': 'AÚN NO PROBADA', 'fr': 'PAS ENCORE TESTÉE'}
EYEBROW = {'en': 'RECIPES WITHOUT BORDERS', 'es': 'RECETAS SIN FRONTERAS', 'fr': 'RECETTES SANS FRONTIÈRES'}
FOOT = {
    'en': 'This recipe has not been kitchen-tested by 2yolks.',
    'es': 'Esta receta aún no ha sido probada en cocina por 2yolks.',
    'fr': "Cette recette n’a pas encore été testée en cuisine par 2yolks.",
}
COUNTRY_EN = {'us': 'United States', 'mx': 'Mexico'}
COUNTRY_ES = {'us': 'Estados Unidos', 'mx': 'México'}
COUNTRY_FR = {'us': 'États-Unis', 'mx': 'Mexique'}

drafts = json.load(open('packages/api/content/wave1.translation-drafts.json'))['drafts']
live_extra = [
    dict(id='9214e255', country='us', lang='en', title='Sweet Potato Casserole with Pecan Streusel'),
    dict(id='2ba6d505', country='us', lang='en', title='Pumpkin Roll with Cream Cheese Filling'),
    dict(id='1c048512', country='us', lang='en', title='Tzatziki Pasta Salad'),
    dict(id='b9e37a49', country='us', lang='en', title='Mini Burger Bites'),
    dict(id='e9bc7550', country='us', lang='en', title='Barbecue Spam and Egg Onigiri'),
    dict(id='6e2a61f5', country='us', lang='en', title='Greek Salad'),
    dict(id='22d307a4', country='us', lang='en', title='Seven-Layer Taco Dip'),
    dict(id='4e23e226', country='mx', lang='es', title='Ponche navideño'),
]
items = (
    list(data['recipes'])
    + [dict(id=x['recipe_id'], country=x['country'], lang=x['lang'], title=x['title']) for x in drafts]
    + live_extra
)

PLUM = '#211729'
PLUM_MID = '#302038'
LIME = '#e0fa80'
CREAM = '#faf8f3'
MUTED = '#d4c8dc'

for r in items:
    img = Image.new('RGB', (W, H), PLUM)
    d = ImageDraw.Draw(img)
    # Top lime accent bar + subtle frame
    d.rectangle([0, 0, W, 28], fill=LIME)
    d.rectangle([56, 84, W - 56, H - 56], outline='#605469', width=2)

    # Eyebrow + Country badge
    country_str = {'fr': COUNTRY_FR, 'es': COUNTRY_ES, 'en': COUNTRY_EN}[r['lang']].get(r['country'], r['country']).upper()
    eyebrow = f"{EYEBROW.get(r['lang'], EYEBROW['en'])}  ·  {country_str}"
    d.text((96, 136), eyebrow, font=ImageFont.truetype(FONT, 30), fill=LIME)

    # Title wrapping
    size = 94
    f = ImageFont.truetype(FONT, size)
    def wrap_px(text, font, maxw):
        out, cur = [], ''
        for w in text.split():
            t = (cur + ' ' + w).strip()
            if d.textlength(t, font=font) <= maxw:
                cur = t
            else:
                out.append(cur)
                cur = w
        out.append(cur)
        return out

    lines = wrap_px(r['title'], f, W - 192)
    while len(lines) > 5 and size > 60:
        size -= 6
        f = ImageFont.truetype(FONT, size)
        lines = wrap_px(r['title'], f, W - 192)

    y = 260
    for ln in lines:
        d.text((96, y), ln, font=f, fill=CREAM)
        y += int(size * 1.22)

    # Decorative divider rule
    d.rectangle([96, y + 36, 236, y + 44], fill=LIME)

    # Honest status pill
    lab = LABEL.get(r['lang'], 'NOT YET TESTED')
    lf = ImageFont.truetype(FONT, 36)
    tw = d.textlength(lab, font=lf)
    d.rectangle([96, H - 420, 96 + tw + 64, H - 344], fill=PLUM_MID, outline=LIME, width=3)
    d.text((128, H - 404), lab, font=lf, fill=LIME)

    # Footnote
    ff = ImageFont.truetype(REG, 32)
    foot = FOOT.get(r['lang'], FOOT['en'])
    words, cur, rows = foot.split(), '', []
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=ff) <= W - 192:
            cur = t
        else:
            rows.append(cur)
            cur = w
    rows.append(cur)
    for k, row in enumerate(rows):
        d.text((96, H - 290 + k * 44), row, font=ff, fill=MUTED)

    # Footer brand mark + two yolks
    d.text((96, H - 156), '2yolks.com', font=ImageFont.truetype(FONT, 60), fill=LIME)
    d.ellipse([W - 196, H - 152, W - 152, H - 108], fill=LIME)
    d.ellipse([W - 140, H - 152, W - 96, H - 108], fill=LIME)

    img.save(f"packages/web/public/img/pin/{r['id']}.{r['lang']}.png", optimize=True)
    print(r['id'], r['lang'], len(lines), size)
