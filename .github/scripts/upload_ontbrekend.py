#!/usr/bin/env python3
"""Uploadt een Fokwijzer-export naar de website, maar enkel paarden die daar nog NIET bestaan.
Bestaande paarden op de site worden nooit overschreven (wijzigingen op de site blijven bewaard).
Andere collecties (bv. systeem/voorouders) worden altijd geschreven.

Gebruik: FOKWIJZER_TOKEN=... python3 upload_ontbrekend.py https://fokwijzer.onrender.com bestand.json
"""
import json, os, re, sys, time, urllib.request, urllib.error

ALLOWED = {"paarden", "veilingen", "aanvragen", "council", "veiling_backlog", "systeem", "partners"}
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,159}$")

def neutralize(v):
    if isinstance(v, str): return v.replace("<", "‹").replace(">", "›")
    if isinstance(v, list): return [neutralize(x) for x in v]
    if isinstance(v, dict): return {k: neutralize(x) for k, x in v.items()}
    return v

def req(url, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method="POST" if data else "GET",
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
    with urllib.request.urlopen(r, timeout=180) as resp:
        return json.loads(resp.read())

def main():
    site, path = sys.argv[1].rstrip("/"), sys.argv[2]
    token = os.environ["FOKWIJZER_TOKEN"]
    exp = json.load(open(path, encoding="utf-8"))
    if exp.get("formaat") != "fokwijzer-export": sys.exit("Geen Fokwijzer-export.")
    lijst = req(site + "/api/c/paarden", token)
    bestaand = {d["id"] for d in lijst}
    if exp.get("modus") == "aanvullen":
        return aanvullen(site, token, exp, {d["id"]: d["data"] for d in lijst})
    print(f"Op de site: {len(bestaand)} paarden.")
    docs, overgeslagen = [], 0
    for coll, items in exp["collecties"].items():
        if coll not in ALLOWED: continue
        for id_, d in items.items():
            if coll == "systeem" and id_ == "instellingen": continue
            if not (ID_RE.match(id_) and isinstance(d, dict)): continue
            if coll == "paarden" and id_ in bestaand:
                overgeslagen += 1; continue
            docs.append({"coll": coll, "id": id_, "data": neutralize(d)})
    print(f"Te uploaden: {len(docs)}; al aanwezig en overgeslagen: {overgeslagen}.")
    ok = fout = 0
    for i in range(0, len(docs), 150):
        blok = docs[i:i+150]
        for poging in range(3):
            try:
                res = req(site + "/api/bulk", token, {"docs": blok})["resultaat"]; break
            except urllib.error.HTTPError as e:
                if e.code in (401, 403): sys.exit(f"Geweigerd ({e.code}): controleer FOKWIJZER_TOKEN.")
                if poging == 2: raise
                time.sleep(10)
            except urllib.error.URLError:
                if poging == 2: raise
                time.sleep(10)
        for r in res:
            if isinstance(r, dict) and r.get("ok"): ok += 1
            else: fout += 1; print("FOUT", r)
    na = len(req(site + "/api/c/paarden", token))
    print(f"Klaar: {ok} opgeslagen, {fout} fouten. Nu {na} paarden op de site.")
    if fout: sys.exit(1)


def aanvullen(site, token, exp, opsite):
    """Vult bestaande paarden aan: enkel lege stamboomvakken en lege velden, bronnen erbij, opmerking aangevuld.
    Niets wat al op de site staat wordt overschreven."""
    docs, nieuw_vak, overgeslagen = [], 0, 0
    for id_, a in exp["collecties"].get("paarden", {}).items():
        cur = opsite.get(id_)
        if not isinstance(cur, dict):
            overgeslagen += 1; continue
        d = json.loads(json.dumps(cur)); veranderd = False
        sb = d.get("stamboom") if isinstance(d.get("stamboom"), dict) else {}
        for k, v in (a.get("stamboom") or {}).items():
            if v and not sb.get(k):
                sb[k] = v; nieuw_vak += 1; veranderd = True
        if sb: d["stamboom"] = sb
        for f in ("stamboek", "geboortejaar", "geslacht", "ueln", "fei_id"):
            if a.get(f) not in (None, "") and not d.get(f):
                d[f] = a[f]; veranderd = True
        if not veranderd:
            overgeslagen += 1; continue
        urls = {b.get("url") for b in d.get("bronnen") or [] if isinstance(b, dict)}
        d["bronnen"] = list(d.get("bronnen") or []) + [b for b in a.get("bronnen", []) if b.get("url") not in urls]
        t = a.get("opmerking_toevoeging")
        if t and t not in str(d.get("opmerking", "")):
            d["opmerking"] = (str(d.get("opmerking", "")) + " " + t).strip()
        if a.get("verrijken_weg"): d.pop("verrijken", None)
        d["bijgewerkt"] = exp.get("datum", d.get("bijgewerkt"))
        docs.append({"coll": "paarden", "id": id_, "data": neutralize(d)})
    print(f"Aanvullen: {len(docs)} paarden ({nieuw_vak} stamboomvakken), {overgeslagen} overgeslagen.")
    fout = 0
    for i in range(0, len(docs), 150):
        for r in req(site + "/api/bulk", token, {"docs": docs[i:i+150]})["resultaat"]:
            if not (isinstance(r, dict) and r.get("ok")): fout += 1; print("FOUT", r)
    print(f"Klaar: {len(docs) - fout} bijgewerkt, {fout} fouten.")
    if fout: sys.exit(1)

main()
