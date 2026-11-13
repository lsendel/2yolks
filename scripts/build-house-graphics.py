# Builds 1200x675 landscape 2yolks house recipe graphic cards (no stock photo,
# honest "NOT YET TESTED" label) in the After Hours visual identity (#211729 / #e0fa80).
# Usage: python3 scripts/build-house-graphics.py --manifest manifest.json --outdir /tmp/out
import argparse
import json
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 675
PLUM = '#211729'
PLUM_MID = '#302038'
LIME = '#e0fa80'
CREAM = '#faf8f3'
MUTED = '#d4c8dc'
RULE = '#605469'


def pick_font(candidates):
    for p in candidates:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f'No font found among {candidates}')


BOLD_FONT = pick_font([
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
])
REG_FONT = pick_font([
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
])


def wrap_lines(draw, text, font, max_w):
    lines, cur = [], ''
    for word in text.split():
        trial = f'{cur} {word}'.strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def render_card(item, out_path):
    img = Image.new('RGB', (W, H), PLUM)
    d = ImageDraw.Draw(img)

    # Top lime bar & editorial border frame
    d.rectangle([0, 0, W, 16], fill=LIME)
    d.rectangle([36, 48, W - 36, H - 36], outline=RULE, width=2)

    cat_label = item.get('category', 'recipes').replace('-', ' & ').upper()
    eyebrow = f"2YOLKS HOUSE VERSION  ·  {cat_label}"
    d.text((72, 76), eyebrow, font=ImageFont.truetype(BOLD_FONT, 22), fill=LIME)

    # Dynamic title sizing
    size = 62
    tf = ImageFont.truetype(BOLD_FONT, size)
    lines = wrap_lines(d, item['title'], tf, W - 144)
    while len(lines) > 3 and size > 40:
        size -= 4
        tf = ImageFont.truetype(BOLD_FONT, size)
        lines = wrap_lines(d, item['title'], tf, W - 144)

    y = 148
    for ln in lines[:4]:
        d.text((72, y), ln, font=tf, fill=CREAM)
        y += int(size * 1.2)

    # Accent divider
    d.rectangle([72, y + 20, 192, y + 26], fill=LIME)

    # Bottom metadata strip
    meta_parts = []
    if item.get('total_minutes'):
        meta_parts.append(f"{item['total_minutes']} min total")
    if item.get('base_servings'):
        serv = item['base_servings']
        serv_str = str(int(serv)) if float(serv).is_integer() else str(serv)
        meta_parts.append(f"{serv_str} servings")
    meta_str = '  ·  '.join(meta_parts)

    pill_text = 'NOT YET TESTED'
    pf = ImageFont.truetype(BOLD_FONT, 22)
    pw = d.textlength(pill_text, font=pf)
    d.rectangle([72, H - 186, 72 + pw + 40, H - 134], fill=PLUM_MID, outline=LIME, width=2)
    d.text((92, H - 172), pill_text, font=pf, fill=LIME)

    if meta_str:
        mf = ImageFont.truetype(REG_FONT, 24)
        d.text((72 + pw + 66, H - 173), meta_str, font=mf, fill=MUTED)

    # Footer brand mark + twin yolks
    d.text((72, H - 104), '2yolks.com', font=ImageFont.truetype(BOLD_FONT, 36), fill=LIME)
    d.ellipse([W - 148, H - 102, W - 116, H - 70], fill=LIME)
    d.ellipse([W - 106, H - 102, W - 74, H - 70], fill=LIME)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--outdir', required=True)
    args = parser.parse_args()
    with open(args.manifest, encoding='utf-8') as f:
        items = json.load(f)
    for item in items:
        rid = item['recipe_id']
        img_id = f"img{rid[:6]}h1"
        out_path = os.path.join(args.outdir, rid, f"{img_id}.png")
        render_card(item, out_path)
    print(f"Rendered {len(items)} house recipe graphics into {args.outdir}")


if __name__ == '__main__':
    main()
