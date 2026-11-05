#!/usr/bin/env python3
"""Haalt de wachtrij met paardaanvragen en een lijst van de paarden op van de website,
voor de geplande Claude-taak die de aanvragen verwerkt. Schrijft naar de map die als argument gegeven wordt:
  aanvragen.json  - aanvragen met status "wachtrij" (zonder wie ze aanvroeg)
  paarden.json    - id, naam, naamvarianten, geboortejaar, geslacht en ouders van elk paard
  bijlagen/<id>.jpg|png|webp - afbeelding of printscreen die de aanvrager meestuurde, ENKEL als de
                    repository privé is (BIJLAGEN_DELEN=true). Is ze openbaar, dan blijven de afbeeldingen
                    op de website en staat in aanvragen.json enkel "bijlage": "niet_gedeeld".
Gebruik: FOKWIJZER_TOKEN=... [BIJLAGEN_DELEN=true] python3 ophalen.py https://fokwijzer.onrender.com uitmap
"""
import base64, json, os, re, sys, time, urllib.request, urllib.error

IMG_RE = re.compile(r"^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$")
EXT = {"png": "png", "jpeg": "jpg", "webp": "webp"}

# Velden die de verwerking nodig heeft. Wie de aanvraag deed (aanvrager_id) gaat niet naar GitHub.
VELDEN = ["naam", "link", "status", "aangevraagd_op", "gekozen_kandidaat", "opnieuw", "reden",
          "oorspronkelijke_naam", "vorige_poging", "kandidaten", "pakket_grootte"]

def get(url, token):
    for poging in range(4):
        try:
            r = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
            with urllib.request.urlopen(r, timeout=120) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403): sys.exit(f"Geweigerd ({e.code}): controleer FOKWIJZER_TOKEN.")
            if poging == 3: raise
        except urllib.error.URLError:
            if poging == 3: raise
        time.sleep(15)  # Render-site kan nog aan het opstarten zijn

def main():
    site, uit = sys.argv[1].rstrip("/"), sys.argv[2]
    token = os.environ["FOKWIJZER_TOKEN"]
    os.makedirs(uit, exist_ok=True)
    delen = os.environ.get("BIJLAGEN_DELEN", "").lower() == "true"
    aanvragen = []
    for d in get(site + "/api/c/aanvragen", token):
        a = d.get("data") or {}
        if a.get("status") != "wachtrij": continue
        x = {k: a[k] for k in VELDEN if k in a}
        x["id"] = d["id"]
        x["sleutel"] = d["id"] + "|" + str(a.get("vorige_poging") or a.get("aangevraagd_op") or "")
        if a.get("bijlage"):
            x["bijlage"] = "niet_gedeeld"
            if delen:
                try:
                    b = (get(site + "/api/c/bijlagen/" + d["id"], token) or {}).get("data") or {}
                    m = IMG_RE.match(b.get("afbeelding") or "")
                    if m:
                        os.makedirs(os.path.join(uit, "bijlagen"), exist_ok=True)
                        naam = d["id"] + "." + EXT[m.group(1)]
                        with open(os.path.join(uit, "bijlagen", naam), "wb") as f:
                            f.write(base64.b64decode(m.group(2)))
                        x["bijlage"] = "bijlagen/" + naam
                except Exception as e:  # een ontbrekende afbeelding mag de wachtrij niet tegenhouden
                    print(f"Afbeelding bij {d['id']} niet opgehaald: {e}")
        aanvragen.append(x)
    aanvragen.sort(key=lambda x: x.get("aangevraagd_op") or "")
    paarden = []
    for d in get(site + "/api/c/paarden", token):
        p = d.get("data") or {}
        sb = p.get("stamboom") or {}
        paarden.append({k: v for k, v in {"id": d["id"], "naam": p.get("naam"), "naam_varianten": p.get("naam_varianten"),
            "geboortejaar": p.get("geboortejaar"), "geslacht": p.get("geslacht"), "v": sb.get("v"), "m": sb.get("m"), "mv": sb.get("mv")}.items() if v})
    paarden.sort(key=lambda x: x["id"])
    with open(os.path.join(uit, "aanvragen.json"), "w", encoding="utf-8") as f:
        json.dump(aanvragen, f, ensure_ascii=False, indent=1)
    with open(os.path.join(uit, "paarden.json"), "w", encoding="utf-8") as f:
        json.dump(paarden, f, ensure_ascii=False, separators=(",", ":"))
    met = sum(1 for a in aanvragen if a.get("bijlage", "").startswith("bijlagen/"))
    print(f"Wachtrij: {len(aanvragen)} aanvragen ({met} met afbeelding). Paarden op de site: {len(paarden)}."
          + ("" if delen else " Afbeeldingen worden niet gedeeld: de repository is openbaar."))

if __name__ == "__main__":
    main()
