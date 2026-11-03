# Importbestanden voor De Fokwijzer

De geplande taak "voorouders" zet hier na elke run een bestand `<datum>-voorouders.json` (formaat fokwijzer-export) met de nieuwe paarden en de teller `systeem/voorouders`.
De GitHub Action `.github/workflows/import-fokwijzer.yml` uploadt elk nieuw bestand naar https://fokwijzer.onrender.com met `tools/upload.py`.

Deze branch wordt niet door Render gebouwd (Render volgt `main`).
Opnieuw proberen: GitHub, Actions, "Import naar De Fokwijzer", Run workflow, en vul het pad van het bestand in.

Uploaden gebeurt met `.github/scripts/upload_ontbrekend.py`: enkel paarden die nog niet op de site staan worden toegevoegd. Bestaande paarden op de site worden nooit overschreven.
`2026-11-03-volledig.json` bevat alle paarden uit De Fokwijzer in Claude, om de site eenmalig bij te werken.
