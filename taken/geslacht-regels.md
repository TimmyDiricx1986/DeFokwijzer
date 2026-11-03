# Regels: ontbrekend geslacht opzoeken (De Fokwijzer)

Invoer: JSON-lijst van pakketten met telkens 1 kandidaat {doc_id, naam, naam_varianten, geboortejaar, stamboek, stamboom_bekend, herkomst, bron_urls}.
Elke kandidaat staat al in de database, maar zonder geslacht. Doel: het geslacht vinden ("hengst" of "merrie"; een ruin is "hengst" en vermeld "ruin" in de opmerking), en wat op dezelfde pagina meekomt. Raak GEEN database aan; schrijf enkel je resultaatbestand.

Budget (strikt): hoogstens 1 WebSearch per kandidaat (mode "standard"), bv. "<naam> <vader> <geboortejaar> horse" of "<naam> hippomundo". Hoogstens 1 WebFetch per 2 kandidaten; begin waar zinvol met een URL uit bron_urls (vaak een veilingpagina waar het geslacht op staat). Snippets met URL volstaan als ze het geslacht duidelijk vermelden. Geen Horsetelex. WebFetch-prompt kort: enkel geslacht, geboortejaar, ouders, stamboek teruggeven. Budget op: rest "niet_gedaan".

Betrouwbaarheid: stamboek/FEI > Hippomundo > dekstation/veiling > nieuws/verkoop. Niets uit geheugen invullen. Identiteit moet passen (naam, geboortejaar en gekende ouders uit stamboom_bekend). Twijfel of meerdere paarden: "niet_gevonden" met korte reden.

Uitvoer per kandidaat: {"doc_id","status":"gevonden"|"niet_gevonden"|"niet_gedaan","aanvulling":{...},"reden"}.
"aanvulling" bevat ENKEL wat je met een bron vond: "geslacht" (verplicht bij gevonden), en indien op de bezochte pagina: "stamboom" (posities v,m,vv,vm,mv,mm,...), "stamboek", "geboortejaar", "ueln" (15 tekens), "fei_id", "bronnen":[{"naam","url","datum"}], "opmerking" (korte zin, Nederlands, geen em-dashes; bv. "Ruin.").
Herschrijf je resultaatbestand na elk pakket (geldige JSON-lijst). Eindig met 1 regel met aantallen per status.
