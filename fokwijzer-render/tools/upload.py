#!/usr/bin/env python3
"""Zet een Fokwijzer-export over naar je online Fokwijzer (bv. op Render).

Gebruik:
  FOKWIJZER_TOKEN='<SERVICE_TOKEN>' python3 tools/upload.py https://www.jouwdomein.be fokwijzer-export.json

Het token is de waarde van SERVICE_TOKEN in de instellingen van je site.
Teksten met punthaken (bv. '<vader> x <moeder>') worden omgezet naar ‹ › zodat ze door de controle raken.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

ALLOWED = {"paarden", "veilingen", "aanvragen", "council", "veiling_backlog", "systeem", "partners"}
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,159}$")
MAX_BATCH_BYTES = 2_000_000


def neutralize(v):
    if isinstance(v, str):
        return v.replace("<", "‹").replace(">", "›")
    if isinstance(v, list):
        return [neutralize(x) for x in v]
    if isinstance(v, dict):
        return {k: neutralize(x) for k, x in v.items()}
    return v


def post(url, token, docs):
    body = json.dumps({"docs": docs}).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["resultaat"]


def main():
    if len(sys.argv) != 3 or not os.environ.get("FOKWIJZER_TOKEN"):
        sys.exit(__doc__)
    site, path = sys.argv[1].rstrip("/"), sys.argv[2]
    if not site.startswith(("https://", "http://localhost", "http://127.0.0.1")):
        sys.exit("Gebruik het https-adres van je site.")
    token = os.environ["FOKWIJZER_TOKEN"]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("formaat") != "fokwijzer-export":
        sys.exit("Dit is geen Fokwijzer-export.")
    docs = []
    for coll, items in data["collecties"].items():
        if coll not in ALLOWED:
            continue
        for id_, d in items.items():
            if coll == "systeem" and id_ == "instellingen":
                continue  # trigger-id's van Claude zijn op de website niet bruikbaar
            if ID_RE.match(id_) and isinstance(d, dict):
                docs.append({"coll": coll, "id": id_, "data": neutralize(d)})
    # in blokken van maximaal 200 documenten en ongeveer 2 MB
    batches, cur, size = [], [], 0
    for d in docs:
        n = len(json.dumps(d))
        if cur and (len(cur) >= 200 or size + n > MAX_BATCH_BYTES):
            batches.append(cur)
            cur, size = [], 0
        cur.append(d)
        size += n
    if cur:
        batches.append(cur)
    url = site + "/api/bulk"
    ok = fail = done = 0
    for b in batches:
        for poging in range(3):
            try:
                res = post(url, token, b)
                break
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    sys.exit("Geen toegang: controleer FOKWIJZER_TOKEN (SERVICE_TOKEN op de site).")
                if poging == 2:
                    sys.exit(f"Upload gestopt: {e}")
                time.sleep(5)
            except Exception as e:  # tijdelijke fout: even wachten en opnieuw
                if poging == 2:
                    sys.exit(f"Upload gestopt: {e}")
                time.sleep(5)
        for r in res:
            if r.get("ok"):
                ok += 1
            else:
                fail += 1
                print("Overgeslagen:", r.get("id"), r.get("fout"))
        done += len(b)
        print(f"{done}/{len(docs)}", end="\r")
    print(f"\nKlaar: {ok} opgeslagen, {fail} overgeslagen.")


if __name__ == "__main__":
    main()
