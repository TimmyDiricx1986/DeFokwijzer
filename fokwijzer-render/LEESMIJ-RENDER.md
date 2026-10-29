# De Fokwijzer op Render

Deze handleiding zet De Fokwijzer online op Render (datacenter Frankfurt), met je eigen domeinnaam en automatisch HTTPS. Je hebt geen server of commandoregel nodig. Alleen de import van je gegevens (stap 5) doe je met één commando.

## Wat je nodig hebt

- Een gratis account op **GitHub** (github.com)
- Een account op **Render** (render.com), met een betaalkaart. De vaste schijf voor de database kan alleen bij een betaald plan.
- Je domeinnaam, bijvoorbeeld `fokwijzer.be`, bij je registrar (de partij waar je het domein kocht)

## 1. De code op GitHub zetten

1. Maak op GitHub een nieuwe repository aan, bijvoorbeeld `fokwijzer`, en zet ze op **Private**.
2. Kies **Add file, Upload files** en sleep de **inhoud** van deze map erin: alle bestanden en mappen, dus niet de map zelf.
3. Zet nooit een bestand `.env` met wachtwoorden of sleutels in GitHub. Dit pakket bevat er geen.
4. Klik op **Commit changes**.

## 2. De site aanmaken met de Blueprint

1. Kies in Render **New, Blueprint** en koppel je GitHub-account.
2. Kies de repository `fokwijzer`. Render leest `render.yaml` en maakt dan in één keer aan:
   - de website (Docker, regio Frankfurt);
   - een schijf van 1 GB op `/data` voor de database, met elke dag een automatische momentopname;
   - een willekeurig `SERVICE_TOKEN`.
3. Render vraagt een paar waarden:

| Instelling | Wat invullen |
|---|---|
| `PUBLIC_URL` | Voorlopig het adres dat Render toont, bv. `https://fokwijzer.onrender.com`. Na stap 6 vervang je het door je domein. |
| `ADMIN_EMAIL` | Je e-mailadres voor de eerste beheerder |
| `ADMIN_NAME` | Je naam |
| `ADMIN_PASSWORD` | Een sterk wachtwoord van minstens 12 tekens |
| `ANTHROPIC_API_KEY` | Optioneel, voor de council. Laat leeg als je die niet gebruikt. |

4. Klik op **Apply**. De eerste keer bouwen duurt enkele minuten.

## 3. Eerste keer inloggen

1. Open het adres van je site en log in met `ADMIN_EMAIL` en `ADMIN_PASSWORD`.
2. Ga daarna in Render naar je service, **Environment**, en **verwijder `ADMIN_PASSWORD`**. Het account blijft bestaan. Je wachtwoord wijzig je voortaan in de site zelf, via de link "Wachtwoord" bovenaan.

## 4. Je gegevens exporteren uit de huidige Fokwijzer

Ga in de huidige Fokwijzer (in Claude) naar **Paarden beheren, Back-up, verhuizen en instellingen**, klik op **Exporteer alle data** en bewaar het bestand.

## 5. Je gegevens importeren

Je hebt Python 3 nodig op je computer (op een Mac is het meestal al aanwezig).

1. Zoek in Render bij **Environment** de waarde van `SERVICE_TOKEN` en kopieer ze.
2. Voer in de map van dit pakket uit:
   ```
   FOKWIJZER_TOKEN='<SERVICE_TOKEN>' python3 tools/upload.py https://fokwijzer.onrender.com fokwijzer-export-2026-10-21.json
   ```
   Op Windows (PowerShell):
   ```
   $env:FOKWIJZER_TOKEN='<SERVICE_TOKEN>'; python tools/upload.py https://fokwijzer.onrender.com fokwijzer-export-2026-10-21.json
   ```
3. Het script meldt hoeveel documenten zijn opgeslagen. Ververs de site: je paarden, veilingen en partners staan erin.

## 6. Je domeinnaam koppelen

1. Ga in Render naar je service, **Settings, Custom Domains**, en voeg je domein toe. Neem beide vormen: `fokwijzer.be` en `www.fokwijzer.be`.
2. Render toont welke DNS-records je moet instellen. Meestal is dat een **A-record** voor `fokwijzer.be` en een **CNAME** voor `www`. Neem ze exact over bij je registrar.
3. Wacht tot Render het domein als **Verified** toont. Het HTTPS-certificaat volgt automatisch.
4. Zet `PUBLIC_URL` bij **Environment** op je definitieve adres, bv. `https://fokwijzer.be`, en bewaar. Render start de site opnieuw.

`PUBLIC_URL` moet exact het adres zijn waarmee bezoekers de site openen. Wijzigingen worden alleen aanvaard vanaf dat adres, als bescherming tegen misbruik vanaf andere sites.

## Beheer

| Wat | Waar |
|---|---|
| Paarden, partners, gebruikers en rollen | In De Fokwijzer zelf, als beheerder |
| Logboeken, herstarten, instellingen | Render-dashboard, bij je service |
| Nieuwe versie online zetten | Bestanden in GitHub vervangen. Render bouwt en publiceert automatisch. |
| Back-ups | Automatisch: Render maakt elke dag een momentopname van de schijf, en de app zelf bewaart 14 dagelijkse kopieën in `/data/backups` |
| Terugzetten | Render-dashboard, **Disks**, kies een momentopname |

## Goed om te weten

- **Tijdens een nieuwe versie:** bij elke nieuwe versie is de site een paar seconden onbereikbaar. Dat komt doordat een dienst met een schijf niet zonder onderbreking kan wisselen.
- **Shell in Render:** gebruik je de **Shell** in Render toch voor de scripts, start ze dan als gebruiker `node`, bv.
  `setpriv --reuid=node --regid=node --init-groups node scripts/create-admin.js jij@mail.be "Jouw Naam"`.
  Anders krijgen de databasebestanden de verkeerde eigenaar.
- **Beveiliging:** zie `BEVEILIGING.md`. De punten "Server" en "Back-ups buiten de server" regelt Render grotendeels voor je.
- **Nog in te vullen:** de privacyverklaring (`src/privacy.html`) en `src/security.txt`.

## Probleem: na een nieuwe versie is alles weg en kan niemand inloggen

Dan staat de database niet op een vaste schijf. Zonder Disk wist Render bij elke nieuwe versie alles: paarden, accounts en geschiedenis. Je ziet dan de voorbeeldpaarden (Fictief) en geen enkel account werkt nog.

**Controleren:** open bij je service de **Logs** na een herstart. Staat er `[opslag] LET OP: /data is GEEN vaste schijf`, dan ontbreekt de Disk. Als beheerder zie je dezelfde waarschuwing ook in een rode balk bovenaan de site.

**Oplossen:**

1. Zet je service op een betaald plan (bv. Starter). Een Disk kan niet bij het gratis plan.
2. Kies **Disks**, **Add Disk**: naam `fokwijzer-data`, Mount Path `/data`, grootte 1 GB. Bewaar.
3. Controleer bij **Environment**: `DATA_DIR` staat op `/data`, en `ADMIN_EMAIL`, `ADMIN_NAME` en `ADMIN_PASSWORD` zijn ingevuld. Het wachtwoord mag het eerste deel van je e-mailadres niet bevatten.
4. Wacht tot de site opnieuw draait. In de Logs staat nu geen waarschuwing meer, en wel `[beheerder] ... aangemaakt`.
5. Log in en importeer je laatste export via **Paarden beheren, Back-up, verhuizen en instellingen**. Of gebruik `tools/upload.py` met het `SERVICE_TOKEN` (zie stap 5 hierboven); daarvoor hoef je niet in te loggen.
6. Pas daarna, als je ziet dat alles na een nieuwe versie blijft staan, verwijder je `ADMIN_PASSWORD`.
