#!/usr/bin/env python3
"""Rights-cleared photo pipeline for 2yolks recipe images.

Every stage runs locally and is validated before anything touches production.
Nothing is served publicly until a human clears a batch (cleared_at), matching
the recipe_images contract in migration 0004 (recorded provenance is NOT
clearance).

Stages:
  source     Query Openverse (CC-licensed image index, no key needed) for each
             recipe; write candidates.json with FULL provenance per candidate
             (creator, license, source page, image url, dimensions).
  variants   Download chosen candidates, center-crop/resize to the site's real
             sizes (hero 1200x675, thumb 480x480), write variants/ + update
             candidates.json with file paths, bytes, dimensions.
  sheet      Render review-sheet.html: per recipe, candidate photos at real
             display sizes with license/creator/source links. This is the
             human gate - Luis marks cleared ids in cleared.txt (one id per
             line, or clicks in a future UI).
  assign     ONLY for cleared ids: print the wrangler commands (r2 put +
             recipe_images INSERT with cleared_at) for review, or execute them
             with --execute (needs a token with R2+D1 scope in env). Records
             style='photo', license, source fields from provenance.

Usage:
  python3 scripts/photos/pipeline.py source --recipes recipes.json --out work/
  python3 scripts/photos/pipeline.py variants --work work/
  python3 scripts/photos/pipeline.py sheet --work work/
  python3 scripts/photos/pipeline.py assign --work work/ --cleared cleared.txt [--execute]

recipes.json: [{"id": "...", "title": "...", "category": "...", "country": "us"}]
"""
import argparse, json, os, sys, time, urllib.parse, urllib.request
from io import BytesIO

from PIL import Image

OPENVERSE = 'https://api.openverse.org/v1/images/'
ALLOWED_LICENSES = 'cc0,pdm,by,by-sa'  # commercial-ok CC licenses only
UA = {'User-Agent': '2yolks-image-pipeline/1.0 (recipe site; provenance-tracked)'}

def http_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def http_bytes(url, cap=25_000_000):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read(cap + 1)
    if len(data) > cap:
        raise ValueError('image too large')
    return data

def queries_for(recipe):
    title = recipe['title']
    words = [w for w in title.split() if len(w) > 3]
    q = [' '.join(words[:4]) + ' food', ' '.join(words[:2]) + ' dish']
    if recipe.get('category'):
        q.append(recipe['category'].replace('-', ' ') + ' food')
    return q

def cmd_source(args):
    recipes = json.load(open(args.recipes))
    os.makedirs(args.out, exist_ok=True)
    out = []
    for rec in recipes:
        cands = []
        seen = set()
        for q in queries_for(rec):
            url = OPENVERSE + '?' + urllib.parse.urlencode({
                'q': q, 'license': ALLOWED_LICENSES, 'page_size': 5,
                'fields': 'id,title,creator,license,license_url,foreign_landing_url,url,width,height,provider'})
            try:
                data = http_json(url)
            except Exception as e:
                print(f"  query failed for {rec['id']} q={q!r}: {e}", file=sys.stderr)
                continue
            for it in data.get('results', []):
                if it['id'] in seen or not it.get('url'):
                    continue
                seen.add(it['id'])
                if (it.get('width') or 0) < 800:
                    continue  # too small for a hero
                cands.append({k: it.get(k) for k in
                    ('id', 'title', 'creator', 'license', 'license_url',
                     'foreign_landing_url', 'url', 'width', 'height', 'provider')})
            time.sleep(1)  # be polite; unauthenticated tier
        out.append({'recipe': rec, 'candidates': cands[:6]})
        print(f"{rec['id']}: {len(cands[:6])} candidates")
    json.dump(out, open(os.path.join(args.out, 'candidates.json'), 'w'), indent=2)
    print(f"wrote {os.path.join(args.out, 'candidates.json')}")

def cmd_variants(args):
    work = json.load(open(os.path.join(args.work, 'candidates.json')))
    vdir = os.path.join(args.work, 'variants')
    os.makedirs(vdir, exist_ok=True)
    for entry in work:
        rid = entry['recipe']['id']
        for c in entry['candidates']:
            try:
                img = Image.open(BytesIO(http_bytes(c['url']))).convert('RGB')
            except Exception as e:
                c['error'] = str(e)
                continue
            for name, (w, h) in {'hero': (1200, 675), 'thumb': (480, 480)}.items():
                v = cover_crop(img, w, h)
                p = os.path.join(vdir, f"{rid}-{c['id'][:8]}-{name}.webp")
                v.save(p, 'WEBP', quality=82)
                c.setdefault('variants', {})[name] = {
                    'path': p, 'bytes': os.path.getsize(p), 'width': w, 'height': h}
    json.dump(work, open(os.path.join(args.work, 'candidates.json'), 'w'), indent=2)
    print('variants written to', vdir)

def cover_crop(img, w, h):
    sw, sh = img.size
    scale = max(w / sw, h / sh)
    img = img.resize((round(sw * scale), round(sh * scale)), Image.LANCZOS)
    x = (img.width - w) // 2
    y = (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))

def cmd_sheet(args):
    work = json.load(open(os.path.join(args.work, 'candidates.json')))
    rows = []
    for entry in work:
        rec = entry['recipe']
        cards = []
        for c in entry['candidates']:
            hero = (c.get('variants') or {}).get('hero', {}).get('path', '')
            rel = os.path.relpath(hero, args.work) if hero else ''
            thumb = (c.get('variants') or {}).get('thumb', {}).get('path', '')
            trel = os.path.relpath(thumb, args.work) if thumb else ''
            cards.append(f'''<div style="margin:14px;padding:12px;border:1px solid #605469;border-radius:6px">
  <div style="display:flex;gap:12px;align-items:flex-start">
    {'<img src="%s" style="width:300px;height:169px;object-fit:cover">' % rel if rel else ''}
    {'<img src="%s" style="width:96px;height:96px;object-fit:cover;border-radius:4px">' % trel if trel else ''}
  </div>
  <div style="font:12px sans-serif;color:#d4c8dc;margin-top:8px">
    <b style="color:#e0fa80">{c["id"][:8]}</b> {c.get("title") or ""}<br>
    by {c.get("creator") or "unknown"} - <a style="color:#e0fa80" href="{c.get("license_url") or ""}">{c.get("license")}</a>
    via {c.get("provider")} - <a style="color:#e0fa80" href="{c.get("foreign_landing_url") or ""}">source page</a>
    {'<br><i>error: ' + c["error"] + '</i>' if c.get("error") else ''}
  </div></div>''')
        rows.append(f'<h2 style="font:20px Georgia;color:#e0fa80">{rec["title"]} <span style="color:#d4c8dc;font:12px sans-serif">{rec["id"]}</span></h2>' + '\n'.join(cards))
    html = f'<!doctype html><html><body style="background:#211729;margin:0;padding:24px"><h1 style="color:#e0fa80;font:24px Georgia">Photo clearance review - mark cleared ids in cleared.txt</h1>{"".join(rows)}</body></html>'
    open(os.path.join(args.work, 'review-sheet.html'), 'w').write(html)
    print('wrote', os.path.join(args.work, 'review-sheet.html'))

def cmd_assign(args):
    work = json.load(open(os.path.join(args.work, 'candidates.json')))
    cleared = set(l.split('#')[0].strip() for l in open(args.cleared) if l.strip() and not l.startswith('#'))
    stmts = []
    for entry in work:
        rec = entry['recipe']
        for c in entry['candidates']:
            if not any(c['id'].startswith(cid) or cid == c['id'][:8] for cid in cleared):
                continue
            for kind, v in (c.get('variants') or {}).items():
                r2_key = f"recipes/{rec['id']}/{kind}-{c['id'][:8]}.webp"
                stmts.append(f"wrangler r2 object put 2yolks-images/{r2_key} --file {v['path']} --content-type image/webp")
                stmts.append(
                    "wrangler d1 execute 2yolks --remote --command \"INSERT INTO recipe_images "
                    f"(id, recipe_id, kind, r2_key, mime, bytes, width, height, style, source_name, source_url, license, cleared_at) VALUES "
                    f"('{rec['id']}-{kind}-{c['id'][:8]}', '{rec['id']}', 'hero', '{r2_key}', 'image/webp', {v['bytes']}, {v['width']}, {v['height']}, 'photo', "
                    f"'{sqlq(c.get('creator') or c.get('provider') or 'unknown')}', '{sqlq(c.get('foreign_landing_url') or '')}', '{sqlq(c.get('license') or 'unknown')}', datetime('now'))\"")
    print('\n'.join(stmts) if stmts else 'nothing cleared')
    if args.execute and stmts:
        import subprocess
        for s in stmts:
            subprocess.run(s, shell=True, check=True)

def sqlq(s):
    return s.replace("'", "''")

p = argparse.ArgumentParser()
sub = p.add_subparsers(dest='cmd', required=True)
s = sub.add_parser('source'); s.add_argument('--recipes', required=True); s.add_argument('--out', required=True); s.set_defaults(f=cmd_source)
s = sub.add_parser('variants'); s.add_argument('--work', required=True); s.set_defaults(f=cmd_variants)
s = sub.add_parser('sheet'); s.add_argument('--work', required=True); s.set_defaults(f=cmd_sheet)
s = sub.add_parser('assign'); s.add_argument('--work', required=True); s.add_argument('--cleared', required=True); s.add_argument('--execute', action='store_true'); s.set_defaults(f=cmd_assign)
args = p.parse_args()
args.f(args)
