# Tennistoernooi-app

Web-app om een tennistoernooitje (dubbels, 2 banen, ±14 deelnemers) te organiseren. Thijs beheert schema en uitslagen, deelnemers kijken live mee op hun telefoon.

## Techniek

- Opmaak volgens de huisstijlgids van Doublesmart (skill `doublesmart-huisstijl`): zwart, lime #ceff69, paars #c4a8e0, grijze panelen #f5f5f5, lettertype Gellix, logo linksboven. Geen emoji, geen tekst in kleine letters behalve het logo
- HTML/CSS/JS zonder bouwstap (ES-modules), hosting via GitHub Pages
- Supabase als database, login en live updates (wordt gekoppeld in stap 4)
- Zonder Supabase-gegevens in `js/config.js` werkt de app lokaal met testdata in localStorage

## Toernooiregels

- 4 rondes van 25 min + 5 min wissel, start 16:15 (inspelen 16:00)
- 14 deelnemers: 7 ervaren, 7 minder ervaren
- Vast schema (SJABLOON in `js/indeling.js`) dat in één keer wordt geloot
- Wie op baan 2 wint, speelt de ronde erna op baan 1 naast een ervaren speler (ronde 2 en 3)
- Ronde 4: twee ervaren spelers spelen op baan 2, elk naast een winnaar van baan 2
- Plekken die van een uitslag afhangen zijn verwijzingen (`@W:1:2:0`) en vullen zichzelf in zodra de score is ingevoerd
- Elke ervaren speler speelt 2 keer; 4 minder ervaren spelers spelen 3 keer, 3 spelen 2 keer
- Nooit twee keer dezelfde partner (harde regel)
- Teams zo gelijk mogelijk: winnaar naast verliezer
- Ranglijst: winstpercentage, dan gemiddeld gamesaldo, dan gemiddeld gewonnen games, dan onderling resultaat; daarna gedeelde plek
- Gelijke stand: één winnend punt bepaalt de winnaar, de games blijven gelijk
- Top 2 van de ranglijst wint

## Bestanden

- `js/config.js`: instellingen (tijden, aantal rondes, Supabase-gegevens)
- `js/data.js`: alle opslag loopt hierlangs (localStorage of Supabase)
- `js/indeling.js`: het vaste schema, loten en verwijzingen invullen
- `js/stand.js`: ranglijst berekenen
- `js/ui.js`: gedeelde hulpfuncties voor beide pagina's
- `js/app.js` + `index.html`: publieke pagina
- `js/admin.js` + `admin.html`: beheerpagina
- `css/style.css`: opmaak
- `assets/`: logo, beeldmerk (icoontje in het tabblad) en de Gellix-lettertypen
- `supabase/schema.sql`: tabellen en toegangsregels

## Lokaal testen

De testserver kan niet rechtstreeks uit de Documenten-map lezen (macOS-rechten). Kopieer de app daarom naar een tijdelijke map en start daar `python3 -m http.server`.

## Stand van zaken

- Live op https://thijsbol2004.github.io/tennistoernooi/ (repo `thijsbol2004/tennistoernooi`, GitHub Pages vanaf `main`)
- Supabase-project `qveetnojychbrworryak` is gekoppeld; het schema met de vaste loting staat in de database
- Bewust niet gebouwd: variant voor een afmelding, zwaardere telling voor baan 1
- Niet aanpassen vlak voor of tijdens het toernooi: browsers onthouden de oude versie tot ±10 minuten
