#!/usr/bin/env python3
"""Zet dekinfo van hengsten (dekgeld, sperma, beschikbaarheid, station) op de website.
Het bestand (formaat fokwijzer-export, modus "dekinfo") bevat per paard-id {"dek": {...}}.
Regels: enkel bestaande hengsten; dekinfo die een beheerder zelf invulde (zonder herkomst "automatisch")
wordt NOOIT overschreven; automatische dekinfo wordt enkel vervangen door nieuwere. Er wordt enkel het
veld "dek" samengevoegd (PATCH), de rest van het paard blijft onaangeroerd.
Gebruik: FOKWIJZER_TOKEN=... python3 dekinfo_uploaden.py https://fokwijzer.onrender.com bestand.json
"""
import json, os, re, sys, time, urllib.request, urllib.error

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,159}$")
URL_RE = re.compile(r"^https?://[^\s/]+\.[^\s]+$", re.I)
SPERMA = {"vers", "diepvries", "natuurlijk"}
BESCHIK = {"beschikbaar", "beperkt", "niet"}
TEKST = {"dekgeld": 160, "seizoen": 20, "toelichting": 300, "station": 120}

def neutralize(v):
    if isinstance(v, str): return v.replace("<", "\u2039").replace(">", "\u203a")
    if isinstance(v, list): return [neutralize(x) for x in v]
    if isinstance(v, dict): return {k: neutralize(x) for k, x in v.items()}
    return v

def req(method, url, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    for poging in range(4):
        try:
            r = urllib.request.Request(url, data=data, method=method,
                headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
            with urllib.request.urlopen(r, timeout=120) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403): sys.exit(f"Geweigerd ({e.code}): controleer FOKWIJZER_TOKEN.")
            if e.code in (400, 404): return {"fout": e.read().decode(errors="replace")[:300]}
            if poging == 3: raise
        except urllib.error.URLError:
            if poging == 3: raise
        time.sleep(15)

def schoon(d, datum):
    """Enkel gekende velden, met grenzen. Geeft None als er niets bruikbaars overblijft."""
    if not isinstance(d, dict): return None
    out = {}
    for k, n in TEKST.items():
        v = d.get(k)
        if isinstance(v, (str, int)) and str(v).strip(): out[k] = str(v).strip()[:n]
    sp = [x for x in (d.get("sperma") or []) if x in SPERMA]
    if sp: out["sperma"] = sorted(set(sp), key=["vers", "diepvries", "natuurlijk"].index)
    if d.get("beschikbaar") in BESCHIK: out["beschikbaar"] = d["beschikbaar"]
    if isinstance(d.get("url"), str) and URL_RE.match(d["url"].strip()): out["url"] = d["url"].strip()[:500]
    b = d.get("bron")
    if isinstance(b, dict) and isinstance(b.get("url"), str) and URL_RE.match(b["url"].strip()):
        out["bron"] = {"naam": str(b.get("naam") or "Bron")[:120], "url": b["url"].strip()[:500]}
    if not any(k in out for k in ("dekgeld", "sperma", "beschikbaar", "station", "url")): return None
    out["herkomst"] = "automatisch"
    out["bijgewerkt"] = str(d.get("bijgewerkt") or datum)[:10]
    return neutralize(out)

def main():
    site, path = sys.argv[1].rstrip("/"), sys.argv[2]
    token = os.environ["FOKWIJZER_TOKEN"]
    exp = json.load(open(path, encoding="utf-8"))
    if exp.get("formaat") != "fokwijzer-export" or exp.get("modus") != "dekinfo": sys.exit("Geen dekinfo-bestand.")
    datum = str(exp.get("datum") or "")[:10]
    ok = overgeslagen = fout = 0
    for id_, item in (exp.get("collecties", {}).get("paarden") or {}).items():
        if not ID_RE.match(id_) or not isinstance(item, dict): fout += 1; print(f"  {id_}: ongeldig"); continue
        dek = schoon(item.get("dek"), datum)
        if not dek: overgeslagen += 1; continue
        cur = (req("GET", f"{site}/api/c/paarden/{id_}", token) or {}).get("data")
        if not isinstance(cur, dict): print(f"  {id_}: paard bestaat niet (meer)"); overgeslagen += 1; continue
        if cur.get("geslacht") != "hengst" or cur.get("ruin"): print(f"  {id_}: geen hengst, overgeslagen"); overgeslagen += 1; continue
        oud = cur.get("dek")
        if isinstance(oud, dict) and oud:
            if oud.get("herkomst") != "automatisch":
                print(f"  {id_}: dekinfo werd zelf ingevuld, niet overschreven"); overgeslagen += 1; continue
            if str(oud.get("bijgewerkt") or "") > dek["bijgewerkt"]:
                print(f"  {id_}: nieuwere dekinfo op de site, niet overschreven"); overgeslagen += 1; continue
        res = req("PATCH", f"{site}/api/c/paarden/{id_}", token, {"data": {"dek": dek}})
        if res and res.get("ok"): ok += 1; print(f"  {id_}: {cur.get('naam')} -> dekinfo bijgewerkt")
        else: fout += 1; print(f"  {id_}: fout {res}")
    print(f"Klaar: {ok} bijgewerkt, {overgeslagen} overgeslagen, {fout} fouten.")
    if fout: sys.exit(1)

if __name__ == "__main__":
    main()
