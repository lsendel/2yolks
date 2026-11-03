# Proposes structured ingredient rows for the live recipes. READ-ONLY: writes a
# proposal file; never touches production. Source text is kept per row.
# Rules: only rows with ONE quantity and ONE recognised unit (or a bare count)
# become structured. A parenthetical alternate amount must agree with the
# conversion within 6% or the row is held. Everything else is HELD as the
# original plain string (still valid, shown as written, never converted).
import json, re, sys
sys.path.insert(0, '.')
data = json.load(open('packages/api/content/wave1.json'))
UNITS = {  # written -> (canonical, to_base, dim)
 'g':('g',1,'m'),'kg':('kg',1000,'m'),'ml':('ml',1,'v'),'l':('l',1000,'v'),'litro':('l',1000,'v'),'litros':('l',1000,'v'),
 'oz':('oz',28.349523125,'m'),'lb':('lb',453.59237,'m'),
 'tsp':('tsp',4.92892159375,'v'),'tbsp':('tbsp',14.78676478125,'v'),'cup':('cup',236.5882365,'v'),'cups':('cup',236.5882365,'v'),
 'taza':('cup',236.5882365,'v'),'tazas':('cup',236.5882365,'v'),
 'cucharadita':('tsp',4.92892159375,'v'),'cucharaditas':('tsp',4.92892159375,'v'),
 'cucharada':('tbsp',14.78676478125,'v'),'cucharadas':('tbsp',14.78676478125,'v'),
}
FR={'¼':.25,'½':.5,'¾':.75,'⅓':1/3,'⅔':2/3}
NUM=r'(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔])'
def num(s):
    s=s.strip()
    if s in FR: return FR[s]
    m=re.fullmatch(r'(\d+)\s+(\d+)/(\d+)',s)
    if m: return int(m[1])+int(m[2])/int(m[3])
    m=re.fullmatch(r'(\d+)/(\d+)',s)
    if m: return int(m[1])/int(m[2])
    return float(s)
def slug(s): 
    import unicodedata
    s=unicodedata.normalize('NFD',s.lower()); s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    return re.sub(r'[^a-z0-9]+','-',s).strip('-')[:24] or 'x'
def parse(raw):
    m=re.match(r'^\s*('+NUM+r')(?:\s*(?:-|–)\s*('+NUM+r'))?\s*(.*)$',raw)
    if not m: return None,'no leading quantity'
    q=num(m[1]); qe=num(m[2]) if m[2] else None; rest=m[3]
    um=re.match(r'^([A-Za-zÀ-ÿ]+)\.?\s*(.*)$',rest)
    unit=None
    if um and um[1].lower() in UNITS: unit=um[1].lower(); rest=um[2]
    alt=None
    pm=re.match(r'^\((?:about\s+)?('+NUM+r')\s*([A-Za-z]+)\)\s*(.*)$',rest)
    if pm and unit and pm[2].lower() in UNITS:
        alt=(num(pm[1]),pm[2].lower()); rest=pm[3]
    if re.search(r'\d',rest): return None,'extra number in text (second amount or size)'
    if unit is None and re.match(r'^\(',rest): return None,'parenthetical without recognised unit'
    if alt:
        c,b,d=UNITS[unit]; c2,b2,d2=UNITS[alt[1]]
        if d!=d2: return None,'alt amount in other dimension'
        a=q*b; z=alt[0]*b2
        if abs(a-z)/z>0.06: return None,f'alt amount disagrees ({a:.0f} vs {z:.0f} base units)'
    rest=re.sub(r'^(de|of)\s+','',rest)
    name,_,note=rest.partition(',')
    return dict(qty=q,qtyEnd=qe,unit=UNITS[unit][0] if unit else None,name=name.strip(),note=note.strip() or None,alt=alt,unit_written=unit),None
out=[];stats={'structured':0,'held':0}
for r in data['recipes']:
    rows=[];refs=set()
    for raw in r['ingredients']:
        p,why=parse(raw)
        if p is None or not p['name']:
            rows.append({'source':raw,'status':'held','reason':why or 'empty name','proposed':raw});stats['held']+=1;continue
        ref=slug(p['name']);base=ref;i=2
        while ref in refs: ref=f'{base}-{i}';i+=1
        refs.add(ref)
        o={'ref':ref,'qty':p['qty'],'name':p['name']}
        if p['qtyEnd'] is not None:o['qtyEnd']=p['qtyEnd']
        if p['unit']:o['unit']=p['unit']
        if p['note']:o['note']=p['note']
        rows.append({'source':raw,'status':'structured','alt_in_source':p['alt'],'proposed':o});stats['structured']+=1
    amt=re.compile(r'\d[\d./¼½¾]*\s*(?:cups?|tbsp|tsp|g|kg|ml|l|oz|lbs?|tazas?|cucharadas?|cucharaditas?|litros?|gramos?)\b',re.I)
    steps=[{'source':s,'status':'held-amount' if amt.search(s) else 'ok'} for s in r['steps']]
    out.append({'id':r['id'],'lang':r['lang'],'title':r['title'],'ingredients':rows,'steps':steps})
json.dump({'stats':stats,'recipes':out},open('packages/api/content/wave1.structured-proposal.json','w'),ensure_ascii=False,indent=1)
print(stats)
for r in out:
    print('##',r['id'])
    for x in r['ingredients']:
        print(' ',x['status'][:4],'|',x['source'],'|',x.get('reason',''))
    print('  steps with amounts held:',sum(s['status']=='held-amount' for s in r['steps']),'of',len(r['steps']))
