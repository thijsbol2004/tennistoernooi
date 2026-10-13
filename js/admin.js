// Beheerpagina: spelers beheren, rondes indelen, uitslagen invoeren en doorschuiven.
import { CONFIG, NIVEAU, rondeTijden } from './config.js';
import {
  laadSpelers,
  laadWedstrijden,
  bewaarSpeler,
  bewaarWedstrijd,
  vervangRonde,
  resetToernooi,
  abonneer,
  isIngelogd,
  inloggen,
  uitloggen,
  gebruiktSupabase,
} from './data.js';
import { genereerRonde, controleerRonde, doorschuifVoorstel } from './indeling.js';
import { berekenStand, winnaarVan } from './stand.js';
import { esc, vanRonde, rondeKlaar, rustSpelers, saldoTekst } from './ui.js';

const inhoud = document.getElementById('inhoud');
const meldingVak = document.getElementById('melding');
const tijden = rondeTijden();
const VELDEN = ['team1_a', 'team1_b', 'team2_a', 'team2_b'];
const DOORSCHUIF_RONDE = CONFIG.GESCHEIDEN_RONDES + 1;

let spelers = [];
let wedstrijden = [];
let tab = 'rondes';
let ingelogd = false;

const naamVan = (id) => spelers.find((s) => s.id === id)?.naam || '?';
const niveauTekst = (niveau) => (niveau === NIVEAU.ERVAREN ? 'Ervaren' : 'Minder ervaren');

// ---------- Meldingen ----------

let meldingTimer = null;

function melding(tekst, isFout = false) {
  meldingVak.textContent = tekst;
  meldingVak.classList.toggle('fout', isFout);
  meldingVak.hidden = false;
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(() => (meldingVak.hidden = true), isFout ? 7000 : 3500);
}

// ---------- Opslaan in volgorde ----------

// Alle schrijfacties en verversingen lopen achter elkaar, zodat snel tikken niets door elkaar gooit
let wachtrij = Promise.resolve();

function inWachtrij(taak) {
  wachtrij = wachtrij.then(taak).catch((fout) => melding(`Er ging iets mis: ${fout.message}`, true));
  return wachtrij;
}

async function laad() {
  [spelers, wedstrijden] = await Promise.all([laadSpelers(), laadWedstrijden()]);
  teken();
}

const ververs = () => inWachtrij(laad);

// ---------- Tab Rondes ----------

// Keuzelijst voor één plek in een wedstrijd
function spelerKeuze(w, veld, rustIds) {
  const huidige = w[veld];
  const opties = spelers
    .filter((s) => s.actief || s.id === huidige)
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true }))
    .map(
      (s) =>
        `<option value="${esc(s.id)}" ${s.id === huidige ? 'selected' : ''}>${esc(s.naam)}${rustIds.has(s.id) ? ' (rust)' : ''}</option>`
    )
    .join('');
  return `<select data-actie="wissel" data-id="${esc(w.id)}" data-veld="${veld}" aria-label="Speler">${opties}</select>`;
}

// Scoreknoppen voor één team
function teller(w, team) {
  const score = team === 1 ? w.score1 : w.score2;
  return `
    <div class="teller">
      <span class="label">Games</span>
      <button data-actie="score" data-id="${esc(w.id)}" data-team="${team}" data-delta="-1" aria-label="Game eraf">−</button>
      <span class="getal">${score ?? '–'}</span>
      <button data-actie="score" data-id="${esc(w.id)}" data-team="${team}" data-delta="1" aria-label="Game erbij">+</button>
    </div>`;
}

function beheerWedstrijdHtml(w, rustIds) {
  const gelijk = w.score1 != null && w.score1 === w.score2;
  const winnaar = winnaarVan(w);
  const puntKnop = (team, a, b) => `
    <button class="knop klein ${winnaar === team ? '' : 'licht'}" data-actie="winnend-punt" data-id="${esc(w.id)}" data-team="${team}">
      ${esc(naamVan(a))} &amp; ${esc(naamVan(b))}
    </button>`;

  return `
    <div class="wedstrijd">
      <div class="baan-label">Baan ${w.baan}</div>
      <div class="beheer-team">
        ${spelerKeuze(w, 'team1_a', rustIds)}${spelerKeuze(w, 'team1_b', rustIds)}
        ${teller(w, 1)}
      </div>
      <div class="tegen">tegen</div>
      <div class="beheer-team">
        ${spelerKeuze(w, 'team2_a', rustIds)}${spelerKeuze(w, 'team2_b', rustIds)}
        ${teller(w, 2)}
      </div>
      ${
        gelijk
          ? `<div class="winnend-punt">
               Gelijk! Wie won het winnende punt?
               <div class="knoppen">${puntKnop(1, w.team1_a, w.team1_b)}${puntKnop(2, w.team2_a, w.team2_b)}</div>
             </div>`
          : ''
      }
      ${
        w.score1 != null
          ? `<div class="knoppen"><button class="knop klein gevaar" data-actie="wis-uitslag" data-id="${esc(w.id)}">Uitslag wissen</button></div>`
          : ''
      }
    </div>`;
}

function rondeBeheerHtml(ronde) {
  const lijst = vanRonde(ronde, wedstrijden);
  const tijd = tijden.find((t) => t.ronde === ronde);
  const klaar = rondeKlaar(ronde, wedstrijden);
  const rust = rustSpelers(ronde, spelers, wedstrijden);
  const rustIds = new Set(rust.map((s) => s.id));
  const status = !lijst.length ? 'Niet ingedeeld' : klaar ? 'Klaar' : 'Bezig';

  return `
    <section class="kaart">
      <div class="kaart-kop">
        <h2>Ronde ${ronde} <span class="tijd">${tijd.start} – ${tijd.eind}</span></h2>
        <span class="status ${klaar ? 'klaar' : ''}">${status}</span>
      </div>
      ${
        lijst.length
          ? lijst.map((w) => beheerWedstrijdHtml(w, rustIds)).join('') +
            `<p class="rust"><strong>Rust:</strong> ${rust.map((s) => esc(s.naam)).join(', ') || 'niemand'}</p>
             <div class="knoppen"><button class="knop licht klein" data-actie="indelen" data-ronde="${ronde}">Opnieuw indelen</button></div>`
          : `<button class="knop" data-actie="indelen" data-ronde="${ronde}">Indeling maken</button>`
      }
    </section>`;
}

// Blok tussen de gescheiden rondes en de rest: wie schuift door naar baan 1
function doorschuifHtml() {
  const stand = berekenStand(spelers, wedstrijden).filter((r) => r.niveau === NIVEAU.BEGINNER && r.actief);
  const rijen = stand
    .map((r) => {
      const speler = spelers.find((s) => s.id === r.id);
      const cijfers = r.gespeeld ? `${r.gewonnen}/${r.gespeeld} gewonnen · saldo ${saldoTekst(r.gemSaldo)}` : 'nog niet gespeeld';
      return `
        <label class="vink">
          <input type="checkbox" data-actie="doorschuif" data-id="${esc(r.id)}" ${speler.doorgeschoven ? 'checked' : ''} />
          <span>${esc(r.naam)}</span>
          <span class="cijfers">${cijfers}</span>
        </label>`;
    })
    .join('');

  return `
    <section class="kaart">
      <div class="kaart-kop"><h2>Doorschuiven naar baan 1</h2></div>
      <p class="uitleg">Aangevinkte spelers spelen vanaf ronde ${DOORSCHUIF_RONDE} mee op baan 1. De lijst staat op volgorde van de tussenstand.</p>
      ${rijen}
      <div class="knoppen">
        <button class="knop licht klein" data-actie="doorschuif-voorstel">Beste ${CONFIG.AANTAL_DOORSCHUIVEN} aanvinken</button>
      </div>
    </section>`;
}

function tekenRondes() {
  let html = '';
  for (let ronde = 1; ronde <= CONFIG.AANTAL_RONDES; ronde++) {
    if (ronde === DOORSCHUIF_RONDE) html += doorschuifHtml();
    html += rondeBeheerHtml(ronde);
  }
  return html;
}

// ---------- Tab Spelers ----------

function niveauKeuze(gekozen, attributen) {
  return `
    <select ${attributen}>
      <option value="${NIVEAU.ERVAREN}" ${gekozen === NIVEAU.ERVAREN ? 'selected' : ''}>${niveauTekst(NIVEAU.ERVAREN)}</option>
      <option value="${NIVEAU.BEGINNER}" ${gekozen === NIVEAU.BEGINNER ? 'selected' : ''}>${niveauTekst(NIVEAU.BEGINNER)}</option>
    </select>`;
}

function tekenSpelers() {
  const actief = spelers.filter((s) => s.actief);
  const ervaren = actief.filter((s) => s.niveau === NIVEAU.ERVAREN).length;
  const gesorteerd = [...spelers].sort(
    (a, b) => b.actief - a.actief || a.niveau.localeCompare(b.niveau) * -1 || a.naam.localeCompare(b.naam, 'nl', { numeric: true })
  );

  const rijen = gesorteerd
    .map(
      (s) => `
      <div class="speler-rij ${s.actief ? '' : 'afgemeld'}">
        <input type="text" value="${esc(s.naam)}" data-actie="naam" data-id="${esc(s.id)}" aria-label="Naam" />
        <button class="knop licht klein" data-actie="actief" data-id="${esc(s.id)}">${s.actief ? 'Afmelden' : 'Aanmelden'}</button>
        <div class="opties">${niveauKeuze(s.niveau, `data-actie="niveau" data-id="${esc(s.id)}" aria-label="Niveau"`)}</div>
      </div>`
    )
    .join('');

  return `
    <section class="kaart">
      <div class="kaart-kop"><h2>Speler toevoegen</h2></div>
      <form id="nieuwe-speler">
        <label class="veld">Naam <input type="text" name="naam" required autocomplete="off" /></label>
        <label class="veld">Niveau ${niveauKeuze(NIVEAU.BEGINNER, 'name="niveau"')}</label>
        <button class="knop" type="submit">Toevoegen</button>
      </form>
    </section>

    <section class="kaart">
      <div class="kaart-kop">
        <h2>Spelers</h2>
        <span class="tijd">${actief.length} actief: ${ervaren} ervaren, ${actief.length - ervaren} minder ervaren</span>
      </div>
      ${rijen || '<p class="leeg">Nog geen spelers.</p>'}
    </section>

    <section class="kaart">
      <div class="kaart-kop"><h2>Opnieuw beginnen</h2></div>
      <p class="uitleg">Wist alle indelingen, uitslagen en doorschuivingen. De spelers blijven staan.</p>
      <div class="knoppen"><button class="knop gevaar" data-actie="reset">Toernooi leegmaken</button></div>
    </section>`;
}

// ---------- Inloggen ----------

function tekenLogin() {
  return `
    <section class="kaart">
      <div class="kaart-kop"><h2>Inloggen als beheerder</h2></div>
      <form id="login">
        <label class="veld">E-mailadres <input type="email" name="email" required autocomplete="username" /></label>
        <label class="veld">Wachtwoord <input type="password" name="wachtwoord" required autocomplete="current-password" /></label>
        <button class="knop" type="submit">Inloggen</button>
      </form>
    </section>`;
}

// ---------- Tekenen ----------

function teken() {
  document.querySelector('.tabs').hidden = !ingelogd;
  document.getElementById('uitloggen').hidden = !ingelogd || !gebruiktSupabase;
  if (!ingelogd) {
    inhoud.innerHTML = tekenLogin();
    return;
  }
  document.querySelectorAll('[data-tab]').forEach((knop) => knop.classList.toggle('actief', knop.dataset.tab === tab));
  inhoud.innerHTML = tab === 'rondes' ? tekenRondes() : tekenSpelers();
}

// ---------- Acties ----------

// Maakt een (nieuwe) indeling voor een ronde
async function deelIn(ronde) {
  const bestaand = vanRonde(ronde, wedstrijden);
  if (bestaand.some((w) => w.score1 != null)) {
    if (!confirm(`Ronde ${ronde} heeft al uitslagen. Opnieuw indelen wist die uitslagen. Doorgaan?`)) return;
  }
  if (ronde > 1 && !rondeKlaar(ronde - 1, wedstrijden)) {
    const vraag = `Ronde ${ronde - 1} heeft nog niet alle uitslagen. De indeling kan dan geen rekening houden met wie daar won of verloor. Toch indelen?`;
    if (!confirm(vraag)) return;
  }
  if (ronde === DOORSCHUIF_RONDE && !spelers.some((s) => s.doorgeschoven)) {
    if (!confirm('Er is nog niemand doorgeschoven naar baan 1. Toch indelen?')) return;
  }

  const voorstel = genereerRonde(ronde, spelers, wedstrijden);
  await inWachtrij(() => vervangRonde(ronde, voorstel.wedstrijden));
  await ververs();
  if (voorstel.waarschuwingen.length) melding(voorstel.waarschuwingen.join(' '), true);
  else melding(`Ronde ${ronde} is ingedeeld.`);
}

// Zet een andere speler op een plek. Speelt die al in deze ronde, dan ruilen ze van plek.
async function wisselSpeler(wedstrijdId, veld, nieuweSpeler) {
  const ronde = wedstrijden.find((w) => w.id === wedstrijdId).ronde;
  const kopie = vanRonde(ronde, wedstrijden).map((w) => ({ ...w }));
  const doel = kopie.find((w) => w.id === wedstrijdId);
  const oudeSpeler = doel[veld];

  for (const w of kopie) for (const v of VELDEN) if (w[v] === nieuweSpeler) w[v] = oudeSpeler;
  doel[veld] = nieuweSpeler;

  const fouten = controleerRonde(ronde, kopie, wedstrijden, spelers);
  if (fouten.length) {
    melding(`Niet gewijzigd. ${fouten.join(' ')}`, true);
    teken(); // keuzelijst terugzetten
    return;
  }

  for (const w of kopie) {
    const origineel = wedstrijden.find((o) => o.id === w.id);
    if (VELDEN.some((v) => w[v] !== origineel[v])) {
      const { id, team1_a, team1_b, team2_a, team2_b } = w;
      inWachtrij(() => bewaarWedstrijd({ id, team1_a, team1_b, team2_a, team2_b }));
    }
  }
  await ververs();
}

// Score aanpassen: meteen op het scherm, opslaan gebeurt op de achtergrond
function pasScoreAan(wedstrijdId, team, delta) {
  const w = wedstrijden.find((x) => x.id === wedstrijdId);
  let score1 = w.score1 ?? 0;
  let score2 = w.score2 ?? 0;
  if (team === 1) score1 = Math.max(0, score1 + delta);
  else score2 = Math.max(0, score2 + delta);

  // Een eerder gekozen winnend punt vervalt zodra de score verandert
  Object.assign(w, { score1, score2, winnaar: null });
  teken();
  inWachtrij(() => bewaarWedstrijd({ id: wedstrijdId, score1, score2, winnaar: null }));
}

function zetWinnendPunt(wedstrijdId, team) {
  const w = wedstrijden.find((x) => x.id === wedstrijdId);
  w.winnaar = team;
  teken();
  inWachtrij(() => bewaarWedstrijd({ id: wedstrijdId, winnaar: team }));
}

function wisUitslag(wedstrijdId) {
  const w = wedstrijden.find((x) => x.id === wedstrijdId);
  Object.assign(w, { score1: null, score2: null, winnaar: null });
  teken();
  inWachtrij(() => bewaarWedstrijd({ id: wedstrijdId, score1: null, score2: null, winnaar: null }));
}

async function zetDoorgeschoven(spelerId, aan) {
  inWachtrij(() => bewaarSpeler({ id: spelerId, doorgeschoven: aan }));
  await ververs();
}

// Vinkt de best presterende minder ervaren spelers aan en de rest uit
async function neemVoorstelOver() {
  const voorstel = new Set(doorschuifVoorstel(spelers, wedstrijden));
  if (!voorstel.size) {
    melding('Er zijn nog geen uitslagen om een voorstel op te baseren.', true);
    return;
  }
  for (const s of spelers.filter((x) => x.niveau === NIVEAU.BEGINNER)) {
    const aan = voorstel.has(s.id);
    if (s.doorgeschoven !== aan) inWachtrij(() => bewaarSpeler({ id: s.id, doorgeschoven: aan }));
  }
  await ververs();
  melding(`Doorgeschoven: ${[...voorstel].map(naamVan).join(' en ')}.`);
}

async function wijzigSpeler(velden) {
  inWachtrij(() => bewaarSpeler(velden));
  await ververs();
}

// ---------- Gebeurtenissen ----------

// Klikken op knoppen
document.addEventListener('click', (e) => {
  const knop = e.target.closest('button[data-actie], button[data-tab]');
  if (!knop) return;

  if (knop.dataset.tab) {
    tab = knop.dataset.tab;
    teken();
    window.scrollTo(0, 0);
    return;
  }

  const { actie, id } = knop.dataset;
  if (actie === 'indelen') deelIn(Number(knop.dataset.ronde));
  if (actie === 'score') pasScoreAan(id, Number(knop.dataset.team), Number(knop.dataset.delta));
  if (actie === 'winnend-punt') zetWinnendPunt(id, Number(knop.dataset.team));
  if (actie === 'wis-uitslag') wisUitslag(id);
  if (actie === 'doorschuif-voorstel') neemVoorstelOver();
  if (actie === 'actief') wijzigSpeler({ id, actief: !spelers.find((s) => s.id === id).actief });
  if (actie === 'reset' && confirm('Alle indelingen en uitslagen wissen? Dit kan niet ongedaan worden.')) {
    inWachtrij(resetToernooi);
    ververs().then(() => melding('Het toernooi is leeggemaakt.'));
  }
  if (actie === 'uitloggen') {
    uitloggen().then(() => {
      ingelogd = false;
      teken();
    });
  }
});

// Wijzigingen in keuzelijsten, vinkjes en naamvelden
document.addEventListener('change', (e) => {
  const veld = e.target.closest('[data-actie]');
  if (!veld) return;
  const { actie, id } = veld.dataset;

  if (actie === 'wissel') wisselSpeler(id, veld.dataset.veld, veld.value);
  if (actie === 'doorschuif') zetDoorgeschoven(id, veld.checked);
  if (actie === 'niveau') wijzigSpeler({ id, niveau: veld.value, doorgeschoven: false });
  if (actie === 'naam') {
    const naam = veld.value.trim();
    if (naam) wijzigSpeler({ id, naam });
    else teken(); // lege naam: oude naam terugzetten
  }
});

// Formulieren: nieuwe speler en inloggen
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const gegevens = new FormData(e.target);

  if (e.target.id === 'nieuwe-speler') {
    const naam = gegevens.get('naam').trim();
    if (!naam) return;
    await wijzigSpeler({ naam, niveau: gegevens.get('niveau'), actief: true, doorgeschoven: false });
    melding(`${naam} is toegevoegd.`);
  }

  if (e.target.id === 'login') {
    try {
      await inloggen(gegevens.get('email'), gegevens.get('wachtwoord'));
      ingelogd = true;
      await ververs();
    } catch (fout) {
      melding(fout.message, true);
    }
  }
});

// ---------- Start ----------

async function start() {
  document.getElementById('testmodus').hidden = gebruiktSupabase;
  try {
    ingelogd = await isIngelogd();
  } catch (fout) {
    melding(`Verbinden mislukt: ${fout.message}`, true);
  }
  if (ingelogd) await ververs();
  else teken();
  abonneer(() => ingelogd && ververs());
}

start();
