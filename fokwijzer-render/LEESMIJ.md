# De Fokwijzer als website

Een wikigids voor en door paardenfokkers. Dit pakket bevat de volledige website: de app, een eigen server met database, accounts met rollen, en een beveiligde installatie met HTTPS.

## Wat zit erin

| Map of bestand | Inhoud |
|---|---|
| `public/` | De website zelf: de Fokwijzer-app, lettertypen (lokaal, niet via Google), privacy- en over-pagina. |
| `server/` | De server (Node.js): API, rechten, inloggen, live updates, AI-advies, back-ups. |
| `scripts/` | Beheerder aanmaken en gegevens importeren. |
| `tools/build.py` | Zet een nieuwe versie van de Fokwijzer-app om naar `public/`. |
| `test/` | Automatische beveiligingstests (`npm test`). |
| `Dockerfile`, `docker-compose.yml`, `Caddyfile` | Installatie op een server, met automatisch HTTPS. |
| `.env.example` | Alle instellingen, met uitleg. |
| `BEVEILIGING.md` | Wat er beveiligd is en wat jij nog moet doen. |

## Rollen

| Rol | Mag |
|---|---|
| Bezoeker (geen account) | Alles lezen: paarden, stamlijnen, matches, veilingen. |
| Lezer | Ook paarden aanvragen die nog ontbreken. Elk nieuw account begint als lezer. |
| Bijdrager | Paarden toevoegen en wijzigen, aanvragen goedkeuren, de council gebruiken, geschiedenis bekijken en een oudere versie terugzetten. |
| Beheerder | Alles, plus gebruikers en rollen, partners en advertenties, veilinggegevens, back-up en import, paarden verwijderen. |

Elke wijziging aan een paard wordt bewaard met wie, wanneer en wat. Via de knop **Geschiedenis** bij een paard zie je alle versies en kan een bijdrager een vorige versie terugzetten.

## Installeren (eenmalig)

Je hebt nodig: een server (VPS) met Docker, bijvoorbeeld bij Hetzner, OVH of Combell, en een domeinnaam waarvan de DNS (A-record) naar die server wijst.

1. Kopieer deze map naar de server.
2. Maak de instellingen aan:
   ```
   cp .env.example .env
   nano .env
   ```
   Vul minstens `DOMAIN` en `PUBLIC_URL` in. Zet `chmod 600 .env`.
3. Start de site:
   ```
   docker compose up -d --build
   ```
   Caddy vraagt automatisch een HTTPS-certificaat aan. Na een minuut staat de site op je domein.
4. Maak de eerste beheerder aan (het wachtwoord wordt gevraagd en is niet zichtbaar):
   ```
   docker compose exec app node scripts/create-admin.js jij@jouwdomein.be "Jouw Naam"
   ```
5. Zet je gegevens over. Exporteer in de huidige Fokwijzer via **Paarden beheren, Back-up, Exporteer alle data**, kopieer het bestand naar de server en importeer:
   ```
   docker compose cp fokwijzer-export.json app:/tmp/export.json
   docker compose exec app node scripts/import.js /tmp/export.json
   ```
   Teksten met punthaken (zoals `<vader> x <moeder>`) worden daarbij omgezet naar ‹ › zodat ze veilig zijn.

## Engelse versie

De site is beschikbaar in het Nederlands en het Engels. Bezoekers kiezen met de knop **NL / EN** bovenaan; de keuze wordt in hun browser onthouden. Wie voor het eerst komt met een browser die niet in het Nederlands staat, krijgt meteen Engels. Deelbare link naar de Engelse versie: `/en` (bv. `https://fokwijzer.onrender.com/en`).

- De app zelf blijft Nederlands. `src/i18n.js` vervangt in het Engels de schermtekst live door de vertaling uit `src/i18n-en.js` (ook meldingen, invulvelden en de stamboomkaart als afbeelding of PDF). De council antwoordt dan ook in het Engels.
- Paardnamen en wat gebruikers zelf schrijven (opmerkingen, bronnen) worden niet vertaald.
- **Nieuwe tekst in de app?** Voeg de Nederlandse zin met zijn Engelse vertaling toe in `src/i18n-en.js` en bouw opnieuw. Ontbreekt een vertaling, dan blijft die tekst gewoon Nederlands staan; er gaat niets stuk.

## Bijwerken

- **Nieuwe versie van de app:** zet het nieuwe HTML-bestand ergens neer en voer `python3 tools/build.py pad/naar/fokwijzer-app.html` uit (op je eigen computer of de server). De lettertypen staan in `src/fonts`, dus daarvoor is geen internet nodig. Daarna `docker compose up -d --build`.
- **Beveiligingsupdates:** maandelijks `docker compose pull && docker compose up -d --build`, en `npm audit` voor de pakketten.

## Back-ups

- De server maakt elke dag een kopie van de database in het volume, onder `/data/backups` (standaard 14 dagen bewaard).
- Die kopieën staan op dezelfde server. Kopieer ze ook regelmatig naar een andere plek, bijvoorbeeld met een nachtelijke taak:
  ```
  docker compose cp app:/data/backups ./backups-$(date +%F)
  ```
- **Terugzetten:** stop de app, vervang `/data/fokwijzer.db` door een back-up, start opnieuw.

## AI-advies (council van experten)

Optioneel. Zet `ANTHROPIC_API_KEY` in `.env`. De sleutel blijft op de server en komt nooit in de browser. Alleen ingelogde bijdragers kunnen de council gebruiken. Er gelden limieten per uur, per dag en per gebruiker (instelbaar), zodat de kosten beheersbaar blijven. Identieke vragen komen uit een cache en kosten niets extra.

## Paarden aanvragen

Een ingelogde gebruiker zet in één aanvraag 1 tot 5 paarden (naam en eventueel een link) en kan 3 aanvragen per dag doen (Belgische tijd). De server controleert beide grenzen, ook bij aanvragen via de API. Paarden-beheerders en beheerders hebben geen daglimiet. Elk paard van een aanvraag krijgt hetzelfde `pakket`-nummer en het `aanvrager_id`, zodat de verwerking weet welke paarden bij elkaar horen en wie het resultaat moet krijgen.

Aanpassen kan in `.env` met `AANVRAAG_PER_DAG` (standaard 3) en `AANVRAAG_MAX_PAARDEN` (standaard 5).

## Automatisering (veilingmeester en aanvragen verwerken)

De geplande taken van vroeger werkten binnen Claude. Op de website kunnen ze via de API met een **service-token**:

1. Maak een token: `openssl rand -base64 48` en zet het als `SERVICE_TOKEN` in `.env`.
2. Een script of geplande taak kan dan gegevens schrijven, bijvoorbeeld een veiling:
   ```
   curl -X PUT https://jouwdomein.be/api/c/veilingen/2026-11-flanders-foal \
     -H "Authorization: Bearer $SERVICE_TOKEN" -H "Content-Type: application/json" \
     -d '{"data": {"veiling": "Flanders Foal Auction november 2026", "lots": []}}'
   ```
   Lezen kan met `GET /api/c/<collectie>`. De aanvragen in de wachtrij vind je met `GET /api/c/aanvragen`.
3. Wil je dat de knoppen **Start verwerking** en **Nu controleren** zo'n taak starten, zet dan `WEBHOOK_VERWERKING_URL`, `WEBHOOK_VEILINGMEESTER_URL` en `WEBHOOK_SECRET` in `.env`. De server stuurt dan een ondertekende POST (header `X-Fokwijzer-Signature`, HMAC-SHA256 van de inhoud).

Bewaar het service-token als een wachtwoord: wie het heeft, heeft beheerdersrechten op de gegevens (niet op gebruikers).

## Lokaal uitproberen

```
npm install
COOKIE_SECURE=false node scripts/create-admin.js test@test.be "Test"
COOKIE_SECURE=false npm start
```
Open daarna http://localhost:8080. Tests draaien met `npm test`.
