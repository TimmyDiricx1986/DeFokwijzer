#!/usr/bin/env python3
"""Verwerkt de resultaten van de subagents (ontbrekende ouders) tot:
- <werkmap>/out/<doc_id>.json + <werkmap>/writes.json : update-entries voor ArtifactData batch (max 45 per batch)
- <werkmap>/aanvulling.json : export in modus "aanvullen" voor de website (imports/)
Gebruik: python3 ouders-schrijf.py <pad naar ouders-rest.json> <werkmap met resultaat_*.json> <datum YYYY-MM-DD>
Overschrijft nooit bestaande waarden: vult enkel lege stamboomvakken en lege velden aan.
"""
import json, glob, os, sys, collections

rest, werk, datum = sys.argv[1], sys.argv[2], sys.argv[3]
POS = ['v','m','vv','vm','mv','mm','vvv','vvm','vmv','vmm','mvv','mvm','mmv','mmm']
K = {k['doc_id']: k for p in json.load(open(rest)) for k in p['kandidaten']}
R, st = [], collections.Counter()
for f in sorted(glob.glob(os.path.join(werk, 'resultaat_*.json'))):
    for r in json.load(open(f)):
        R.append(r); st[r.get('status')] += 1
os.makedirs(os.path.join(werk, 'out'), exist_ok=True)
writes, site, nped, nveld = [], {}, 0, 0
for r in R:
    if r.get('status') != 'gevonden' or not r.get('aanvulling') or r.get('doc_id') not in K:
        continue
    k = K[r['doc_id']]; d = k['record']; a = r['aanvulling']
    upd, notes, nieuw_sb = {}, [], {}
    sb = dict(d.get('stamboom') or {})
    for p in POS:
        v = (a.get('stamboom') or {}).get(p)
        if not v: continue
        if not sb.get(p): sb[p] = v; nieuw_sb[p] = v; nped += 1
        elif sb[p].strip().lower() != v.strip().lower(): notes.append(f"{p.upper()} volgens bron: {v} (in record: {sb[p]})")
    if nieuw_sb: upd['stamboom'] = sb
    velden = {}
    for f in ('stamboek', 'geboortejaar', 'geslacht', 'ueln', 'fei_id'):
        v = a.get(f)
        if v in (None, ''): continue
        if f == 'ueln' and len(str(v)) != 15: continue
        if not d.get(f): upd[f] = v; velden[f] = v; nveld += 1
        elif str(d[f]).lower() != str(v).lower(): notes.append(f"{f} volgens bron: {v} (in record: {d[f]})")
    if not upd: continue
    oud = {b.get('url') for b in d.get('bronnen') or []}
    nieuwe_bronnen = [b for b in a.get('bronnen', []) if b.get('url') not in oud]
    upd['bronnen'] = list(d.get('bronnen') or []) + nieuwe_bronnen
    extra = ' '.join(x for x in [a.get('opmerking'), ('Afwijking: ' + '; '.join(notes) + '.') if notes else ''] if x)
    toevoeging = f"Aangevuld op {datum} (ontbrekende ouders): " + (extra or 'zie bronnen.')
    upd['opmerking'] = (d.get('opmerking', '') + ' ' + toevoeging).strip()
    upd['bijgewerkt'] = datum
    if d.get('verrijken'): upd['verrijken'] = {"__delete__": True}
    pad = os.path.abspath(os.path.join(werk, 'out', r['doc_id'] + '.json'))
    json.dump(upd, open(pad, 'w'), ensure_ascii=False)
    writes.append({'op': 'update', 'collection': 'paarden', 'doc_id': r['doc_id'], 'file_path': pad, 'if_version': k['versie']})
    site[r['doc_id']] = dict(velden, stamboom=nieuw_sb, bronnen=nieuwe_bronnen, opmerking_toevoeging=toevoeging, verrijken_weg=bool(d.get('verrijken')))
json.dump(writes, open(os.path.join(werk, 'writes.json'), 'w'))
json.dump({"formaat": "fokwijzer-export", "datum": datum, "modus": "aanvullen", "collecties": {"paarden": site}},
          open(os.path.join(werk, 'aanvulling.json'), 'w'), ensure_ascii=False, indent=1)
print(dict(st), '| updates', len(writes), '| stamboomvakken', nped, '| velden', nveld)
