#!/usr/bin/env python3
"""Zet de resultaten van de geplande Claude-taak bij de aanvragen op de website.
Het bestand (formaat fokwijzer-export, modus "aanvragen") bevat per aanvraag-id de resultaatvelden
en "verwerkt_voor" (de sleutel uit de wachtrij). Een resultaat wordt enkel geschreven als de aanvraag
nog bestaat, nog in de wachtrij of bezig is, en nog dezelfde sleutel heeft (anders is ze intussen
geannuleerd of opnieuw aangevraagd). Er wordt samengevoegd (PATCH), dus pakket en aanvrager blijven bewaard.
Gebruik: FOKWIJZER_TOKEN=... python3 resultaat_uploaden.py https://fokwijzer.onrender.com bestand.json
"""
import json, os, re, sys, time, urllib.request, urllib.error

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,159}$")
VELDEN = {"status", "verwerkt_op", "voorstel", "conflicten", "agent_notitie", "kandidaten", "verwerkt_voor"}
STATUSSEN = {"klaar", "niet_gevonden"}

def neutralize(v):
    if isinstance(v, str): return v.replace("<", "‹").replace(">", "›")
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
            if e.code == 400: return {"fout": e.read().decode(errors="replace")[:300]}
            if poging == 3: raise
        except urllib.error.URLError:
            if poging == 3: raise
        time.sleep(15)

def main():
    site, path = sys.argv[1].rstrip("/"), sys.argv[2]
    token = os.environ["FOKWIJZER_TOKEN"]
    exp = json.load(open(path, encoding="utf-8"))
    if exp.get("formaat") != "fokwijzer-export" or exp.get("modus") != "aanvragen": sys.exit("Geen resultaatbestand voor aanvragen.")
    ok = overgeslagen = fout = 0
    for id_, r in (exp.get("collecties", {}).get("aanvragen") or {}).items():
        if not ID_RE.match(id_) or not isinstance(r, dict) or r.get("status") not in STATUSSEN:
            print(f"  {id_}: ongeldig resultaat"); fout += 1; continue
        cur = req("GET", f"{site}/api/c/aanvragen/{id_}", token).get("data")
        if not cur:
            print(f"  {id_}: aanvraag bestaat niet meer (geannuleerd)"); overgeslagen += 1; continue
        sleutel = id_ + "|" + str(cur.get("vorige_poging") or cur.get("aangevraagd_op") or "")
        if cur.get("status") not in ("wachtrij", "bezig") or r.get("verwerkt_voor") != sleutel:
            print(f"  {id_}: intussen gewijzigd ({cur.get('status')}), niet overschreven"); overgeslagen += 1; continue
        patch = neutralize({k: v for k, v in r.items() if k in VELDEN})
        res = req("PATCH", f"{site}/api/c/aanvragen/{id_}", token, {"data": patch})
        if res and res.get("ok"): ok += 1; print(f"  {id_}: {cur.get('naam')} -> {r['status']}")
        else: fout += 1; print(f"  {id_}: fout {res}")
    print(f"Klaar: {ok} bijgewerkt, {overgeslagen} overgeslagen, {fout} fouten.")
    if fout: sys.exit(1)

if __name__ == "__main__":
    main()
