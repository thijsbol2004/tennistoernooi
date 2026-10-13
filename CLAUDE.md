# Tennistoernooi-app

Web-app om een tennistoernooitje (dubbels, 2 banen, ±14 deelnemers) te organiseren. Thijs beheert schema en uitslagen, deelnemers kijken live mee op hun telefoon.

## Techniek

- HTML/CSS/JS zonder bouwstap (ES-modules), hosting via GitHub Pages
- Supabase als database, login en live updates (wordt gekoppeld in stap 4)
- Zonder Supabase-gegevens in `js/config.js` werkt de app lokaal met testdata in localStorage

## Toernooiregels

- 4 rondes van 25 min + 5 min wissel, start 16:15 (inspelen 16:00)
- Ronde 1 en 2: ervaren spelers op baan 1, minder ervaren op baan 2
- Na ronde 2 schuiven de 2 beste minder ervaren spelers door naar baan 1 (voorstel, Thijs beslist)
- Nooit twee keer dezelfde partner (harde regel)
- Teams zo gelijk mogelijk: winnaar naast verliezer
- Ranglijst: winstpercentage, dan gemiddeld gamesaldo, dan gemiddeld gewonnen games
- Gelijke stand: één winnend punt bepaalt de winnaar, de games blijven gelijk
- Top 2 van de ranglijst wint

## Bestanden

- `js/config.js`: instellingen (tijden, aantal rondes, Supabase-gegevens)
- `js/data.js`: alle opslag loopt hierlangs (localStorage of Supabase)
- `js/indeling.js`: rondes genereren, controleren en doorschuifvoorstel
- `js/stand.js`: ranglijst berekenen

## Stand van zaken

- [x] Stap 1: basis en logica zonder database
- [ ] Stap 2: publieke pagina (Nu / Schema / Stand)
- [ ] Stap 3: beheerpagina
- [ ] Stap 4: Supabase koppelen
- [ ] Stap 5: online zetten via GitHub Pages
- [ ] Stap 6: echte deelnemers invoeren
