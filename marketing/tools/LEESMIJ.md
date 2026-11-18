# Video's maken voor De Fokwijzer (marketingagent)

De marketingagent maakt de video's bij de posts zelf: een schermopname van De Fokwijzer op gsm-formaat (1080x1920, 30 beelden per seconde), met tekst in beeld, het eindbeeld van de dag en het deuntje van De Fokwijzer eronder.

De echte site (fokwijzer.onrender.com) is vanuit de cloud niet bereikbaar. Daarom draait `mock.py` een lokale nabouw met de echte site-bestanden en de echte paardengegevens uit de branch `main`. Geen npm nodig.

## Stappen
1. Haal de site op: `git worktree add /home/claude/site-main origin/main` (na `git fetch origin`).
2. Start de nabouw op de achtergrond:
   `python3 marketing/tools/mock.py /home/claude/site-main/fokwijzer-render/public /home/claude/site-main/imports &`
   Ingelogd als testaccount "Demo Fokker"; enkel de collectie paarden wordt geladen (geen aanvragen of gegevens van gebruikers). `opname.js` maakt de stal van het testaccount bij elke opname leeg.
3. Schrijf een dagscript `marketing/tools/dagen/<JJJJ-MM-DD>.js` (kopieer een bestaand dagscript). Hulpjes in `opname.js`: `scene`, `snap`, `vulTot`, `scrollNaar`, `springNaar`, `top`, `topTekst`, `typ`, `tab`, `knop`, `veegOpzij`, `verwijderTekst`.
   Draai: `node marketing/tools/dagen/<datum>.js <framesmap>`.
4. Bekijk enkele beelden per scène met de Read-tool (verkleind op een contactblad). Let op: niets mag afgesneden zijn, geen persoonlijke gegevens, geen meldingen die enkel in de nabouw verschijnen.
5. Schrijf `marketing/tools/dagen/<datum>.json` (scènes met tekst in beeld, eindbeeld, eind_s, uit) en draai `python3 marketing/tools/afwerken.py <json>`. Het deuntje wordt op maat gemaakt (`deuntje-synth.py`): motief vooraan, motief op het eindbeeld, zachte uitfade.
6. Bekijk 4 tot 5 beelden uit de afgewerkte video (ffmpeg -ss) en zet de video in `marketing/<datum>/`.

## Afspraken
- Lengte 15 tot 45 seconden; scènes van 2 tot 7 seconden; eindbeeld 3 tot 4 seconden.
- Enkel echte paarden uit de database; testgegevens (zoals een vaccinatie in het testdossier) enkel als voorbeeld van hoe een functie werkt, zonder er iets over te beweren.
- Niet lang stilstaan bij onderdelen die breder zijn dan het scherm; de stamboom mag opzij geveegd worden.
- Datumvelden staan in Belgische notatie (opname.js zet LANG=nl_BE).
- Geen voice-over: die spreekt Timmy zelf in (vaste zinnen in `claude/marketing-klankbeeld.md`); zet de muziek dan op 20 tot 30%.
