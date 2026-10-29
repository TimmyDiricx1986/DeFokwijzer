#!/usr/bin/env python3
"""Zet de Fokwijzer-app (één HTML-bestand) om naar de website in public/.

Gebruik:  python3 tools/build.py <pad/naar/fokwijzer-app.html>

- splitst HTML, CSS en JavaScript (nodig voor een strikte Content-Security-Policy);
- vervangt Google Fonts door lokale lettertypen (geen gegevens naar derden);
- past teksten aan die naar Claude verwezen;
- voegt de koppeling met de server toe (fokwijzer-api.js).
Draai dit opnieuw telkens je een nieuwe versie van de app hebt.
"""
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
SRC = ROOT / "src"


def fail(msg):
    sys.exit("Build mislukt: " + msg)


def rep(s, old, new, count=1, required=True):
    n = s.count(old)
    if required and n != count:
        fail(f"verwacht {count}x maar vond {n}x: {old[:70]!r}")
    return s.replace(old, new)


def transform(html, links=('/over.html', '/privacy.html')):
    """Splitst de app in (css, body, js) en past alles aan voor gebruik buiten Claude."""

    m_css = re.search(r"<style>(.*?)</style>", html, re.S)
    m_js = re.search(r"<script>(.*?)</script>", html, re.S)
    if not m_css or not m_js:
        fail("geen <style> of <script> gevonden")
    css, js = m_css.group(1), m_js.group(1)
    body = html[m_css.end():m_js.start()].strip()
    after = html[m_js.end():].strip()
    if "<script" in body or "<script" in after:
        fail("onverwacht extra <script>")
    if re.search(r"\son[a-z]+\s*=", body):
        fail("inline event-handlers in de HTML zijn niet toegestaan door de CSP")

    # ---------------------------------------------------------------- HTML-aanpassingen
    # Geplande taken (Claude-taken) bestaan niet op de website
    body = rep(body, '<div class="card" id="bkTasks" style="margin-top:12px">', '<div class="card" id="bkTasks" style="margin-top:12px" hidden>')
    body = rep(body, '<p class="small muted" style="margin:0 0 12px">Back-up, verhuizen en instellingen van De Fokwijzer. Alleen voor beheerders.</p>', '<p class="small muted" style="margin:0 0 12px">Back-up, verhuizen en gebruikers van De Fokwijzer. Alleen voor beheerders.</p>')
    body = rep(body, "<span>Powered by DeDilieHoeve</span></footer>",
               '<span>Powered by DeDilieHoeve</span><span class="fw-links"><a href="%s" target="_top">Over</a> · <a href="%s" target="_top">Privacy</a></span></footer>' % links)

    # ---------------------------------------------------------------- JavaScript-aanpassingen
    texts = [
        ("De council werkt alleen in de Claude-app, aangemeld, met toestemming om Claude te gebruiken.",
         "De council is beschikbaar voor ingelogde paarden-beheerders, als AI-advies op de server is ingesteld."),
        ("Dit gebruikt je eigen Claude-verbruik (5 vragen).", "Dit telt mee voor je limiet van AI-vragen (5 vragen)."),
        ("Je gaf geen toestemming om Claude te gebruiken voor deze pagina.", "Log in als paarden-beheerder om de council te gebruiken."),
        ("Claude is niet beschikbaar voor dit account.", "AI-advies is niet beschikbaar op deze server."),
        ("Aanvragen kan alleen als de pagina in Claude geopend is terwijl je aangemeld bent.", "Log in om een paard aan te vragen."),
        ("In deze weergave kan niets bewaard worden. Open de pagina in Claude terwijl je aangemeld bent.", "Log in om bij te dragen."),
        ('Starten kan alleen in de Claude-app met de connector Claude Code Remote. Je kunt ook in de chat vragen: \\"verwerk de aanvragen\\".',
         "Automatisch verwerken is niet ingesteld op deze server, of je bent niet ingelogd als paarden-beheerder."),
        ('"Starten lukte niet ("+(c||"onbekend")+").";', '(err&&err.message)||"Starten lukte niet.";'),
        ('"Starten lukte niet ("+(err&&err.code||"onbekend")+"). Je kunt ook in de chat vragen: \\"laat de veilingmeester controleren\\"."',
         '(err&&err.message)||"Starten lukte niet."'),
        ('"De connector Claude Code Remote moet opnieuw verbonden worden (claude.ai, Instellingen, Connectors)."', '"Log opnieuw in."'),
        ('"De connector Claude Code Remote is niet beschikbaar voor deze weergave. Voeg hem toe in claude.ai, Instellingen, Connectors, of vraag in de chat: \\"verwerk de aanvragen\\"."',
         '"Automatisch verwerken is niet ingesteld op deze server."'),
        ("Je hebt geen rechten om paarden toe te voegen of te wijzigen. Vraag de eigenaar om je paarden-beheerdersrechten te geven.",
         "Je hebt geen rechten om paarden toe te voegen of te wijzigen. Log in als paarden-beheerder, of vraag die rol aan bij Account maken."),
    ]
    for old, new in texts:
        js = rep(js, old, new)
    # Taken heten op de website gewoon "verwerking" en "veilingmeester".
    js = re.sub(r'const VM_TRIGGER="[^"]*";', 'const VM_TRIGGER="veilingmeester";', js)
    js = re.sub(r'const RUN_TRIGGER="[^"]*";', 'const RUN_TRIGGER="verwerking";', js)
    js = rep(js, "(state.inst&&state.inst.vm_trigger)||VM_TRIGGER", "VM_TRIGGER")
    js = rep(js, "(state.inst&&state.inst.run_trigger)||RUN_TRIGGER", "RUN_TRIGGER")
    # Gebruikers (ingelogd, zonder paarden-beheerdersrechten) mogen paarden aanvragen.
    js = rep(js, "state.canWrite=can!==false;", "state.canWrite=can===true;state.canAsk=!!(user&&user.level>=1);")
    js = rep(js, 'const can=!!db&&state.canWrite&&state.dbState==="ready";$("aBtn").disabled=!can;',
             'const can=!!db&&state.canAsk&&state.dbState==="ready";$("aBtn").disabled=!can;')
    js = rep(js, 'if(!db||!state.canWrite){st.className="status err";st.textContent="Aanvragen is hier niet mogelijk.";return}',
             'if(!db||!state.canAsk){st.className="status err";st.textContent="Log in om een paard aan te vragen.";return}')
    js = rep(js, 'finally{$("aBtn").disabled=!state.canWrite}', 'finally{$("aBtn").disabled=!state.canAsk}')
    # Wiki-geschiedenis per paard.
    js = rep(js, '<button class="btn danger" type="button" data-act="del" data-own=',
             '<button class="btn ghost" type="button" data-act="hist" data-id="${esc(h.id)}">Geschiedenis</button><button class="btn danger" type="button" data-act="del" data-own=')
    if re.search(r"Claude|in de chat|claude\.ai", js.replace("Claude Code Remote", "")):
        left = sorted(set(re.findall(r"[^\"'`]{0,40}(?:Claude|in de chat|claude\.ai)[^\"'`]{0,40}", js.replace("Claude Code Remote", ""))))
        fail("nog verwijzingen naar Claude: " + "; ".join(left))
    if "eval(" in js or "new Function" in js:
        fail("eval/new Function niet toegestaan")

    return css, body, js


def main():
    if len(sys.argv) != 2:
        fail("geef het pad naar de app mee")
    css, body, js = transform(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))

    # ---------------------------------------------------------------- CSS
    site_css = (SRC / "site.css").read_text(encoding="utf-8")

    # ---------------------------------------------------------------- schrijven
    if PUB.exists():
        shutil.rmtree(PUB)
    (PUB / "fonts").mkdir(parents=True)
    (PUB / "app.js").write_text(js.strip() + "\n", encoding="utf-8")
    (PUB / "app.css").write_text(css.strip() + "\n\n/* Website */\n" + site_css, encoding="utf-8")
    shutil.copy(SRC / "fokwijzer-api.js", PUB / "fokwijzer-api.js")
    for f in ["privacy.html", "over.html", "404.html", "robots.txt", "favicon.png"]:
        shutil.copy(SRC / f, PUB / f)
    (PUB / ".well-known").mkdir()
    shutil.copy(SRC / "security.txt", PUB / ".well-known" / "security.txt")
    build_fonts()

    page = f"""<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>De Fokwijzer</title>
<meta name="description" content="De Fokwijzer: een wikigids voor en door paardenfokkers. Zoek springpaarden, vergelijk combinaties, bekijk stamlijnen en veilingprijzen.">
<meta name="theme-color" content="#2F5A3A">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/app.css">
</head>
<body>
{body}
<script src="/fokwijzer-api.js"></script>
<script src="/app.js"></script>
</body>
</html>
"""
    (PUB / "index.html").write_text(page, encoding="utf-8")
    print("Klaar: public/ opgebouwd.")


FONTS = [("cinzel", "Cinzel", [600, 700]), ("bitter", "Bitter", [500, 600, 700]), ("source-sans-3", "Source Sans 3", [400, 600, 700]), ("ibm-plex-mono", "IBM Plex Mono", [400, 500])]
RANGES = {
    "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
}


def build_fonts():
    src = ROOT / "node_modules" / "@fontsource"
    if not src.exists():
        fail("lettertypen ontbreken: voer eerst 'npm run fonts' uit")
    out = []
    for pkg, family, weights in FONTS:
        for w in weights:
            for sub in ["latin-ext", "latin"]:
                name = f"{pkg}-{sub}-{w}-normal.woff2"
                shutil.copy(src / pkg / "files" / name, PUB / "fonts" / name)
                out.append(f"@font-face{{font-family:'{family}';font-style:normal;font-display:swap;font-weight:{w};"
                           f"src:url(./{name}) format('woff2');unicode-range:{RANGES[sub]}}}")
    (PUB / "fonts" / "fonts.css").write_text("\n".join(out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
