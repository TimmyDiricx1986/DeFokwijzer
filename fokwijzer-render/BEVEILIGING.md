# Beveiliging van De Fokwijzer

Dit document beschrijft wat er beveiligd is, hoe het getest werd en wat je zelf nog moet doen voor de lancering.

## Wat ingebouwd is

**Toegang en accounts**
- Wachtwoorden met scrypt (sterk, met salt). Minimaal 12 tekens; voor de hand liggende wachtwoorden worden geweigerd.
- Sessiecookie `__Host-fw_sess`: HttpOnly, Secure, SameSite=Strict, 14 dagen geldig. In de database staat alleen een hash van het token.
- Inloggen: per IP-adres maximaal 20 pogingen per kwartier. Per e-mailadres worden pogingen één voor één afgehandeld, met een oplopende vertraging en maximaal 10 mislukte pogingen per kwartier. Er is geen harde blokkering, zodat niemand een ander buiten kan sluiten.
- Foutmeldingen verraden niet of een e-mailadres een account heeft.
- Een wachtwoordwijziging of rolwijziging meldt alle andere sessies af. De laatste beheerder kan niet verwijderd of gedegradeerd worden.

**Rechten**
- Elke collectie heeft vaste rechten voor lezen, aanmaken, wijzigen en verwijderen (zie `server/validate.js`). Onbekende namen worden altijd geweigerd.
- De server controleert alles zelf. Knoppen verbergen in de browser is alleen voor het gemak.
- Lezers kunnen alleen een naam en een link aanvragen; status en agentresultaten worden door de server bepaald.

**Aanvallen via de browser**
- Content-Security-Policy: alleen scripts, stijlen, lettertypen en verbindingen van de eigen site. Geen inline scripts, geen frames (`frame-ancestors 'none'`), geen plug-ins.
- CSRF: elke wijziging vereist een eigen header en wordt geweigerd als ze van een andere site komt.
- Alle gegevens worden bij het tonen ge-escaped. Links naar buiten moeten met `http://` of `https://` beginnen.
- De server weigert bovendien HTML-tags, `javascript:`-links (ook verstopt met tabs, entiteiten of hoofdletters), `data:`-documenten en gevaarlijke veldnamen (`__proto__` en dergelijke).
- Extra headers: HSTS, nosniff, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy.

**Misbruik en overbelasting**
- Limieten op API-verzoeken, wijzigingen per minuut en grote lijsten (40 per minuut voor bezoekers en lezers). Lijsten hebben een ETag, zodat browsers niets opnieuw downloaden als er niets veranderde.
- Maximaal 8 live verbindingen per IP-adres. Maximale grootte per document en per verzoek.
- AI-advies: alleen voor bijdragers, met limieten per uur, per dag en per gebruiker. De API-sleutel staat alleen op de server.
- Webhooks werken alleen met een ondertekening (WEBHOOK_SECRET).

**Server en gegevens**
- De app draait in Docker als gewone gebruiker, met een alleen-lezen bestandssysteem, zonder extra rechten en met een geheugenlimiet. Alleen Caddy (HTTPS) is van buitenaf bereikbaar.
- Volledige audit-log: aanmeldingen, mislukte pogingen, elke wijziging met de vorige en nieuwe versie.
- Dagelijkse back-up van de database. Geen tracking, geen externe lettertypen of scripts.

## Hoe het getest werd

- 19 automatische tests in `test/api.test.js` (`npm test`): rechten per rol, CSRF, validatie, verstopte scripts, inlogbeperking, service-token, headers en meer.
- Een browsertest van de volledige app als bezoeker, lezer, bijdrager en beheerder, zonder CSP-fouten.
- Een onafhankelijke code-review met aanvalspogingen. Alle gevonden punten (onder meer collectienamen als `constructor`, verstopte `javascript:`-links, valse agentresultaten via aanvragen, het buitensluiten van accounts en overbelasting) zijn opgelost en daarna opnieuw getest.

## Wat je zelf nog moet doen

1. **Geheimen:** `.env` met `chmod 600`, nooit in git of een gedeelde map. Gebruik voor `SERVICE_TOKEN` en `WEBHOOK_SECRET` lange willekeurige waarden (`openssl rand -base64 48`).
2. **Server:** SSH alleen met sleutels (wachtwoordlogin uit), automatische beveiligingsupdates aan, firewall met alleen de poorten 22, 80 en 443 open.
3. **Back-ups buiten de server:** kopieer de dagelijkse back-ups naar een andere locatie en test één keer of terugzetten werkt.
4. **Teksten invullen:** de gegevens tussen [haken] in `public/privacy.html` en het e-mailadres in `public/.well-known/security.txt`. Laat de privacyverklaring nalezen. Ik ben geen jurist.
5. **Registratie:** met `REGISTRATION=open` kan iedereen een lezersaccount maken. Dat is veilig, want lezers kunnen niets wijzigen. Zet `DEFAULT_ROLE` nooit op `bijdrager` met open registratie.
6. **Rechten op gegevens:** controleer per bron (stamboeken, HorseTelex, veilinghuizen) of je de gegevens openbaar mag tonen.
7. **Onderhoud:** maandelijks updaten (zie LEESMIJ) en `npm audit` draaien. Bekijk de audit-log af en toe op vreemde activiteit.

## Mogelijke volgende stappen

- Tweestapsverificatie (TOTP) voor beheerders.
- Wachtwoord vergeten via e-mail (vraagt een maildienst).
- Moderatie: wijzigingen van nieuwe bijdragers eerst laten goedkeuren.
- Paginering van de paardenlijst als de database veel groter wordt.
