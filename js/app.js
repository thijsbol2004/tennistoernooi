// Publieke pagina: Nu / Schema / Stand. Alleen lezen.
import { CONFIG, rondeTijden } from './config.js';
import { laadSpelers, laadWedstrijden, abonneer, gebruiktSupabase } from './data.js';
import { berekenStand } from './stand.js';
import { losOp } from './indeling.js';
import {
  esc,
  vanRonde,
  huidigeRonde,
  toernooiKlaar,
  rustSpelers,
  maakPlekNaam,
  wedstrijdHtml,
  saldoTekst,
} from './ui.js';

const inhoud = document.getElementById('inhoud');
const tijden = rondeTijden();

let spelers = [];
let wedstrijden = []; // het schema met alle bekende namen ingevuld
let tab = 'nu';

const tijdVan = (ronde) => tijden.find((t) => t.ronde === ronde);

// ---------- Onderdelen ----------

// Eén ronde: kop met tijd, de wedstrijden en wie er rust
function rondeHtml(ronde, kop) {
  const lijst = vanRonde(ronde, wedstrijden);
  const tijd = tijdVan(ronde);
  const rust = rustSpelers(ronde, spelers, wedstrijden);
  const plekNaam = maakPlekNaam(spelers, wedstrijden);

  let onder = '';
  if (rust) onder = `<p class="rust"><strong>Rust:</strong> ${rust.map((s) => esc(s.naam)).join(', ') || 'niemand'}</p>`;
  else if (lijst.length) onder = '<p class="rust">De open plekken worden ingevuld zodra de uitslagen binnen zijn.</p>';

  return `
    <section class="kaart">
      <div class="kaart-kop">
        <h2>${kop || `Ronde ${ronde}`}</h2>
        <span class="tijd">${tijd.start} – ${tijd.eind}</span>
      </div>
      ${lijst.length ? lijst.map((w) => wedstrijdHtml(w, plekNaam)).join('') + onder : '<p class="leeg">Nog niet ingedeeld.</p>'}
    </section>`;
}

function tijdschemaHtml() {
  return `
    <section class="kaart">
      <div class="kaart-kop"><h2>Tijdschema</h2></div>
      <ul class="tijdschema">
        <li><span>Inspelen</span><span>${CONFIG.START_INSPELEN}</span></li>
        ${tijden.map((t) => `<li><span>Ronde ${t.ronde}</span><span>${t.start} – ${t.eind}</span></li>`).join('')}
      </ul>
    </section>`;
}

// ---------- Tabs ----------

function tekenNu() {
  if (!wedstrijden.length) {
    return `
      <section class="kaart"><p class="leeg">Het schema wordt nog gemaakt. Kom zo terug!</p></section>
      ${tijdschemaHtml()}`;
  }

  if (toernooiKlaar(wedstrijden)) {
    // Bij een gedeelde plek kunnen er meer dan twee winnaars zijn
    const top = berekenStand(spelers, wedstrijden).filter((r) => r.rang <= 2);
    return `
      <section class="kaart podium">
        <h2>🏆 Winnaars</h2>
        ${top.map((r) => `<div class="podium-plek"><span class="plek">${r.rang}</span><span>${esc(r.naam)}</span></div>`).join('')}
        <p class="rust">Bekijk de volledige eindstand onder Stand.</p>
      </section>`;
  }

  const ronde = huidigeRonde(wedstrijden);
  const volgende = ronde + 1;
  return rondeHtml(ronde, `Nu: ronde ${ronde}`) + (volgende <= CONFIG.AANTAL_RONDES ? rondeHtml(volgende, `Hierna: ronde ${volgende}`) : '');
}

function tekenSchema() {
  return tijden.map((t) => rondeHtml(t.ronde)).join('');
}

function tekenStand() {
  const stand = berekenStand(spelers, wedstrijden);
  const klaar = toernooiKlaar(wedstrijden);
  const gespeeld = stand.some((r) => r.gespeeld > 0);
  if (!gespeeld) return '<section class="kaart"><p class="leeg">Er zijn nog geen uitslagen.</p></section>';

  const rijen = stand
    .map(
      (r) => `
      <tr class="${r.gespeeld && r.rang <= 2 ? 'top' : ''}">
        <td class="num">${r.gespeeld ? r.rang : '–'}</td>
        <td class="naam">${esc(r.naam)}</td>
        <td class="num">${r.gespeeld}</td>
        <td class="num">${r.gewonnen}</td>
        <td class="num">${r.gespeeld ? Math.round(r.winstPct * 100) + '%' : '–'}</td>
        <td class="num">${r.gespeeld ? saldoTekst(r.gemSaldo) : '–'}</td>
      </tr>`
    )
    .join('');

  return `
    <section class="kaart">
      <div class="kaart-kop"><h2>${klaar ? 'Eindstand' : 'Tussenstand'}</h2></div>
      <table class="stand">
        <thead>
          <tr><th>#</th><th class="naam">Naam</th><th title="Gespeeld">Gesp</th><th title="Gewonnen">Gew</th><th>Winst</th><th>Saldo</th></tr>
        </thead>
        <tbody>${rijen}</tbody>
      </table>
      <p class="uitleg">
        Volgorde: eerst het percentage gewonnen wedstrijden, daarna het gemiddelde gamesaldo per wedstrijd
        (gewonnen min verloren games). Zo maakt het niet uit of je 2 of 3 keer hebt gespeeld.
        Staan spelers dan nog gelijk, dan telt het onderling resultaat. Is ook dat gelijk, dan delen ze de plek.
      </p>
    </section>`;
}

// ---------- Tekenen en verversen ----------

function teken() {
  document.querySelectorAll('[data-tab]').forEach((knop) => knop.classList.toggle('actief', knop.dataset.tab === tab));
  inhoud.innerHTML = tab === 'nu' ? tekenNu() : tab === 'schema' ? tekenSchema() : tekenStand();
}

async function ververs() {
  try {
    const [nieuweSpelers, ruw] = await Promise.all([laadSpelers(), laadWedstrijden()]);
    spelers = nieuweSpelers;
    wedstrijden = losOp(ruw);
    teken();
  } catch (fout) {
    inhoud.innerHTML = `<section class="kaart"><p class="leeg">Laden mislukt: ${esc(fout.message)}</p></section>`;
  }
}

document.querySelectorAll('[data-tab]').forEach((knop) =>
  knop.addEventListener('click', () => {
    tab = knop.dataset.tab;
    teken();
    window.scrollTo(0, 0);
  })
);

document.getElementById('titel').textContent = CONFIG.TOERNOOI_NAAM;
document.title = CONFIG.TOERNOOI_NAAM;
document.getElementById('testmodus').hidden = gebruiktSupabase;

ververs();
abonneer(ververs);
