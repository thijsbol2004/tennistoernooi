// Gedeelde hulpfuncties voor de publieke pagina en de beheerpagina.
// Alle functies hier werken met het "opgeloste" schema (zie losOp in indeling.js).
import { CONFIG } from './config.js';
import { winnaarVan } from './stand.js';
import { PLEKKEN, isVerwijzing, leesVerwijzing, mogelijkeSpelers } from './indeling.js';

// Maakt tekst veilig om in HTML te zetten
export const esc = (tekst) =>
  String(tekst).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Wedstrijden van één ronde, gesorteerd op baan
export function vanRonde(ronde, wedstrijden) {
  return wedstrijden.filter((w) => w.ronde === ronde).sort((a, b) => a.baan - b.baan);
}

// Hebben alle wedstrijden van de ronde een uitslag?
export function rondeKlaar(ronde, wedstrijden) {
  const lijst = vanRonde(ronde, wedstrijden);
  return lijst.length > 0 && lijst.every((w) => winnaarVan(w) !== null);
}

// De eerste ronde die nog niet klaar is (of null)
export function huidigeRonde(wedstrijden) {
  for (let ronde = 1; ronde <= CONFIG.AANTAL_RONDES; ronde++) {
    if (vanRonde(ronde, wedstrijden).length && !rondeKlaar(ronde, wedstrijden)) return ronde;
  }
  return null;
}

// Zijn alle rondes gespeeld?
export function toernooiKlaar(wedstrijden) {
  for (let ronde = 1; ronde <= CONFIG.AANTAL_RONDES; ronde++) {
    if (!rondeKlaar(ronde, wedstrijden)) return false;
  }
  return true;
}

// Wie spelen er niet in deze ronde. Geeft null zolang nog niet alle namen bekend zijn.
export function rustSpelers(ronde, spelers, wedstrijden) {
  const lijst = vanRonde(ronde, wedstrijden);
  if (!lijst.length || lijst.some((w) => !w.compleet)) return null;
  const bezet = new Set(lijst.flatMap((w) => PLEKKEN.map((plek) => w[plek])));
  return spelers.filter((s) => s.actief && !bezet.has(s.id));
}

// Maakt een functie die van een plek de tekst maakt:
// een naam, of bij een open plek "Harvey of Lorenzo"
export function maakPlekNaam(spelers, opgelost) {
  const naam = (id) => esc(spelers.find((s) => s.id === id)?.naam || '?');
  return (waarde) => {
    if (!isVerwijzing(waarde)) return naam(waarde);
    const kandidaten = mogelijkeSpelers(waarde, opgelost);
    if (kandidaten) {
      const namen = kandidaten.map(naam);
      const laatste = namen.pop();
      return `<span class="of">${namen.join(', ')} of ${laatste}</span>`;
    }
    const v = leesVerwijzing(waarde);
    return `<span class="of">${v.wint ? 'winnaar' : 'verliezer'} baan ${v.baan} (ronde ${v.ronde})</span>`;
  };
}

// HTML voor één wedstrijd: twee teams met eventueel de uitslag
export function wedstrijdHtml(w, plekNaam) {
  const winnaar = winnaarVan(w);
  const gelijk = w.score1 != null && w.score1 === w.score2;
  const team = (nr, a, b, score) => `
    <div class="team ${winnaar === nr ? 'winnaar' : ''}">
      <span class="namen">${plekNaam(a)} <span class="en">&amp;</span> ${plekNaam(b)}</span>
      ${winnaar === nr && gelijk ? '<span class="wp" title="Gewonnen op winnend punt">winnend punt</span>' : ''}
      <span class="score">${score ?? '–'}</span>
    </div>`;
  return `
    <div class="wedstrijd baan-${w.baan} ${w.compleet ? '' : 'open'}">
      <div class="baan-label">Baan ${w.baan}</div>
      ${team(1, w.team1_a, w.team1_b, w.score1)}
      ${team(2, w.team2_a, w.team2_b, w.score2)}
    </div>`;
}

// Gemiddeld saldo netjes weergeven, bijv. +1,5
export function saldoTekst(getal) {
  const afgerond = Math.round(getal * 10) / 10;
  const tekst = Math.abs(afgerond).toFixed(1).replace('.', ',');
  return afgerond > 0 ? `+${tekst}` : afgerond < 0 ? `−${tekst}` : tekst;
}
