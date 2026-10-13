# Tennistoernooi-app

Web-app om een tennistoernooitje (dubbels, 2 banen, ±14 deelnemers) te organiseren. Thijs beheert schema en uitslagen, deelnemers kijken live mee op hun telefoon.

## Techniek

- Opmaak in de huisstijl van Doublesmart (wit/zwart, lime #ceff68, teal #37b79f, lila #b191d6, lettertype Outfit als vervanger van Gellix)
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
- Ranglijst: winstpercentage, dan gemiddeld gamesaldo, dan gemiddeld gewonnen games
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
- `supabase/schema.sql`: tabellen en toegangsregels

## Lokaal testen

De testserver kan niet rechtstreeks uit de Documenten-map lezen (macOS-rechten). Kopieer de app daarom naar een tijdelijke map en start daar `python3 -m http.server`.

## Stand van zaken

- [x] Stap 1: basis en logica zonder database
- [x] Stap 2: publieke pagina (Nu / Schema / Stand)
- [x] Stap 3: beheerpagina
- [ ] Stap 4: Supabase koppelen (code en `supabase/schema.sql` staan klaar; project aanmaken en gegevens in `js/config.js` zetten moet nog)
- [ ] Stap 5: online zetten via GitHub Pages
- [ ] Stap 6: echte deelnemers invoeren
