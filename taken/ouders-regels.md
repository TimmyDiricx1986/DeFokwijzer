# Regels: ontbrekende ouders opzoeken (De Fokwijzer)

Invoer: JSON-lijst van pakketten {kaartpaard, kandidaten:[{doc_id, naam, naam_varianten, geslacht, geboortejaar, stamboek, stamboom_bekend, ontbreekt, kinderen_op_kaarten}]}.
Elke kandidaat is een paard dat al in de database staat, maar waarvan vader (v), moeder (m) en/of moedersvader (mv) ontbreken ("ontbreekt").
Doel: per kandidaat de ontbrekende ouders vinden, en wat op dezelfde pagina meekomt. Raak GEEN database aan; schrijf enkel je resultaatbestand.

Budget (strikt):
- Hoogstens 1 WebSearch per kandidaat (mode "standard"), bv. "<naam> <geboortejaar> <bekende vader of kind> hippomundo" of "<naam> horse pedigree".
- Gemiddeld hoogstens 1 WebFetch per 2 kandidaten. Bij voorkeur een Hippomundo-stamboompagina (hippomundo.com/.../pedigree/...) van het paard zelf, of van een kind op de kaart: daarop staan meerdere generaties, dus vaak ook andere kandidaten van hetzelfde pakket. Snippets met URL volstaan als ze genoeg zeggen.
- Geen Horsetelex. WebFetch-prompt kort: enkel namen, geboortejaren, stamboek en posities teruggeven.
- Budget op: rest krijgt status "niet_gedaan".

Betrouwbaarheid: stamboek/FEI > Hippomundo > dekstation/veiling > nieuws/verkoop. Niets uit geheugen invullen: elk gegeven moet op een bezochte pagina of in een snippet met URL staan.
Identiteit moet passen bij wat bekend is: naam, geboortejaar (indien bekend), geslacht, gekende ouders in stamboom_bekend, en de kinderen op de kaarten (het paard staat daar op "positie"; het moet 3 tot 30 jaar per generatie ouder zijn dan dat kind). Past het niet of zijn er meerdere kandidaten: niet gebruiken, status "niet_gevonden" met korte reden.

Uitvoer per kandidaat: {"doc_id","status":"gevonden"|"niet_gevonden"|"niet_gedaan","aanvulling":{...},"reden"}.
"aanvulling" bevat ENKEL velden die je met een bron vond (onbekend = weglaten):
- "stamboom": object met posities v,m,vv,vm,mv,mm,vvv,vvm,vmv,vmm,mvv,mvm,mmv,mmm (V=vader, M=moeder, MV=vader van de moeder). Vul zoveel posities als de pagina geeft.
- "stamboek", "geboortejaar", "geslacht" ("hengst"|"merrie"), "ueln" (exact 15 tekens), "fei_id" als ze op de bezochte pagina staan. Niet apart naar zoeken.
- "bronnen": [{"naam","url","datum":"2026-11-03"}]
- "opmerking": korte zin als iets afwijkt van wat bekend is (bv. andere schrijfwijze, ander geboortejaar). Nederlands, geen em-dashes.
Namen zoals in het stamboek, niet in hoofdletters.

Herschrijf je resultaatbestand na elk pakket (geldige JSON-lijst). Eindig met 1 regel met aantallen per status; geen verslag.
