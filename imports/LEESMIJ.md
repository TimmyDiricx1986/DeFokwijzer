# Importbestanden voor De Fokwijzer

De geplande taak "voorouders" zet hier na elke run een bestand `<datum>-voorouders.json` (formaat fokwijzer-export) met de nieuwe paarden en de teller `systeem/voorouders`.
De GitHub Action `.github/workflows/import-fokwijzer.yml` uploadt elk nieuw bestand naar https://fokwijzer.onrender.com met `tools/upload.py`.

Deze branch wordt niet door Render gebouwd (Render volgt `main`).
Opnieuw proberen: GitHub, Actions, "Import naar De Fokwijzer", Run workflow, en vul het pad van het bestand in.

Uploaden gebeurt met `.github/scripts/upload_ontbrekend.py`: enkel paarden die nog niet op de site staan worden toegevoegd. Bestaande paarden op de site worden nooit overschreven.
`2026-11-03-volledig.json` bevat alle paarden uit De Fokwijzer in Claude, om de site eenmalig bij te werken.

## Paardaanvragen van de website

1. De geplande taak "Fokwijzer: aanvragen website verwerken" start de Action **Wachtrij ophalen**. Die zet de aanvragen met status "wachtrij" en een lijst van alle paarden op de branch `wachtrij` (map `wachtrij/`). Wie een aanvraag deed, gaat niet mee naar GitHub.
2. De taak zoekt de paarden op en zet het resultaat in `imports/<datum>-aanvragen-<uur>.json` (modus "aanvragen").
3. De Action **Import naar De Fokwijzer** zet die resultaten met `.github/wachtrij/resultaat_uploaden.py` bij de aanvragen op de site (status "klaar" of "niet_gevonden"). Een aanvraag die intussen geannuleerd of opnieuw aangevraagd is, wordt niet overschreven.
4. De beheerder keurt goed op de site; zodra alle paarden van een aanvraag afgehandeld zijn, krijgt de aanvrager een mail.
