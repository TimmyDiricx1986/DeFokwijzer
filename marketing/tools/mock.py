"""Lokale nabouw van De Fokwijzer voor schermopnames (marketing).

Gebruik: python3 mock.py <public-map> <imports-map> [poort]
- <public-map>: fokwijzer-render/public van de branch main (de echte site-bestanden).
- <imports-map>: map imports/ van de branch main (Fokwijzer-exports met echte paarden).
Ingelogd als testaccount "Demo Fokker" (rol paardenbeheerder). Wijzigingen blijven enkel in het geheugen.
Geen npm nodig: enkel Python-standaardbibliotheek.
"""
import http.server, json, sys, re, glob, os, urllib.parse
PUB, IMP = sys.argv[1], sys.argv[2]
PORT = int(sys.argv[3]) if len(sys.argv) > 3 else 8080
DOCS = {}
OPENBAAR = {"paarden"}
for f in sorted(glob.glob(os.path.join(IMP, "*.json"))):
    try: d = json.load(open(f, encoding="utf-8"))
    except Exception: continue
    if not isinstance(d, dict) or d.get("formaat") != "fokwijzer-export": continue
    for coll, docs in (d.get("collecties") or {}).items():
        for i, doc in (docs or {}).items():
            if coll not in OPENBAAR: continue  # geen aanvragen of gegevens van andere gebruikers in beeld
            if isinstance(doc, dict): DOCS.setdefault(coll, {})[i] = doc
import copy
BEGIN = copy.deepcopy(DOCS)
USER = {"id": 1, "naam": "Demo Fokker", "email": "demo@fokwijzer.test", "rol": "paardenbeheerder", "aanvraag": None, "partner": False}
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=PUB, **k)
    def log_message(s, *a): pass
    def js(s, o, code=200):
        b = json.dumps(o).encode(); s.send_response(code); s.send_header("Content-Type", "application/json")
        s.send_header("Content-Length", str(len(b))); s.end_headers(); s.wfile.write(b)
    def body(s):
        n = int(s.headers.get("Content-Length") or 0)
        try: return json.loads(s.rfile.read(n) or b"{}")
        except Exception: return {}
    def path_(s): return urllib.parse.urlparse(s.path).path
    def do_GET(s):
        p = s.path_()
        if p == "/api/me": return s.js({"gebruiker": USER, "registratie": True, "ai": False, "taken": {"verwerking": False, "veilingmeester": False}})
        if p == "/api/mail/status": return s.js({"ingesteld": True, "email": "", "actief": False})
        if p == "/api/stream":
            s.send_response(200); s.send_header("Content-Type", "text/event-stream"); s.end_headers()
            s.wfile.write(b"retry: 600000\n\n"); s.wfile.flush(); return
        m = re.match(r"^/api/c/([a-z_]+)/([^/]+)$", p)
        if m: return s.js({"id": m[2], "data": DOCS.get(m[1], {}).get(m[2])})
        m = re.match(r"^/api/c/([a-z_]+)$", p)
        if m: return s.js([{"id": k, "data": v} for k, v in DOCS.get(m[1], {}).items()])
        if p.startswith("/api/"): return s.js({})
        if p == "/": s.path = "/index.html"
        return super().do_GET()
    def do_PUT(s):
        m = re.match(r"^/api/c/([a-z_]+)/([^/]+)$", s.path_()); b = s.body()
        if m: DOCS.setdefault(m[1], {})[m[2]] = b.get("data", b); return s.js({"id": m[2], "ok": True, "data": DOCS[m[1]][m[2]]})
        s.js({"ok": True})
    def do_PATCH(s):
        m = re.match(r"^/api/c/([a-z_]+)/([^/]+)$", s.path_()); b = s.body()
        if m:
            d = dict(DOCS.get(m[1], {}).get(m[2]) or {}); d.update(b.get("data", {})); DOCS.setdefault(m[1], {})[m[2]] = d
            return s.js({"id": m[2], "ok": True})
        s.js({"ok": True})
    def do_POST(s):
        s.body()
        if s.path_() == "/__reset":  # testaccount leegmaken voor een nieuwe opname
            DOCS.clear(); DOCS.update(copy.deepcopy(BEGIN)); return s.js({"ok": True})
        if s.path_() == "/api/stat": s.send_response(204); s.end_headers(); return
        s.js({"ok": True})
    def do_DELETE(s):
        m = re.match(r"^/api/c/([a-z_]+)/([^/]+)$", s.path_())
        if m: DOCS.get(m[1], {}).pop(m[2], None)
        s.js({"ok": True})
print(f"{sum(len(v) for v in DOCS.values())} documenten geladen; http://127.0.0.1:{PORT}/?lang=nl", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
