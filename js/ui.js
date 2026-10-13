// Gedeelde hulpfuncties voor de publieke pagina en de beheerpagina.
import { CONFIG } from './config.js';
import { winnaarVan } from './stand.js';

// Maakt tekst veilig om in HTML te zetten
export const esc = (tekst) =>
  String(tekst).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Wedstrijden van één ronde, gesorteerd op baan
export function vanRonde(ronde, wedstrijden) {
  return wedstrijden.filter((w) => w.ronde === ronde).sort((a, b) => a.baan - b.baan);
}

// Is de ronde ingedeeld en hebben alle wedstrijden een uitslag?
export function rondeKlaar(ronde, wedstrijden) {
  const lijst = vanRonde(ronde, wedstrijden);
  return lijst.length > 0 && lijst.every((w) => winnaarVan(w) !== null);
}

// De eerste ingedeelde ronde die nog niet klaar is (of null)
export function huidigeRonde(wedstrijden) {
  for (let ronde = 1; ronde <= CONFIG.AANTAL_RONDES; ronde++) {
    if (vanRonde(ronde, wedstrijden).length && !rondeKlaar(ronde, wedstrijden)) return ronde;
  }
  return null;
}

// De laatste ronde die helemaal klaar is (of 0)
export function laatsteKlareRonde(wedstrijden) {
  let laatste = 0;
  for (let ronde = 1; ronde <= CONFIG.AANTAL_RONDES; ronde++) {
    if (rondeKlaar(ronde, wedstrijden)) laatste = ronde;
  }
  return laatste;
}

// Zijn alle rondes gespeeld?
export function toernooiKlaar(wedstrijden) {
  for (let ronde = 1; ronde <= CONFIG.AANTAL_RONDES; ronde++) {
    if (!rondeKlaar(ronde, wedstrijden)) return false;
  }
  return true;
}

// Wie spelen er niet in deze ronde
export function rustSpelers(ronde, spelers, wedstrijden) {
  const bezet = new Set(vanRonde(ronde, wedstrijden).flatMap((w) => [w.team1_a, w.team1_b, w.team2_a, w.team2_b]));
  return spelers.filter((s) => s.actief && !bezet.has(s.id));
}

// HTML voor één wedstrijd: twee teams met eventueel de uitslag
export function wedstrijdHtml(w, namen) {
  const winnaar = winnaarVan(w);
  const gelijk = w.score1 != null && w.score1 === w.score2;
  const team = (nr, a, b, score) => `
    <div class="team ${winnaar === nr ? 'winnaar' : ''}">
      <span class="namen">${esc(namen.get(a) || '?')} <span class="en">&amp;</span> ${esc(namen.get(b) || '?')}</span>
      ${winnaar === nr && gelijk ? '<span class="wp" title="Gewonnen op winnend punt">winnend punt</span>' : ''}
      <span class="score">${score ?? '–'}</span>
    </div>`;
  return `
    <div class="wedstrijd">
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
