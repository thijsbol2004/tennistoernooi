// Beheerpagina: spelers beheren, het schema maken en uitslagen invoeren.
import { CONFIG, NIVEAU, rondeTijden } from './config.js';
import {
  laadSpelers,
  laadWedstrijden,
  bewaarSpeler,
  bewaarWedstrijd,
  vervangSchema,
  resetToernooi,
  abonneer,
  isIngelogd,
  isBeheerder,
  inloggen,
  uitloggen,
  gebruiktSupabase,
} from './data.js';
import { maakSchema, losOp, wisselSpelers, mogelijkeSpelers, isVerwijzing, PLEKKEN } from './indeling.js';
import { winnaarVan } from './stand.js';
import { esc, vanRonde, rondeKlaar, rustSpelers, maakPlekNaam } from './ui.js';

const inhoud = document.getElementById('inhoud');
const meldingVak = document.getElementById('melding');
const tijden = rondeTijden();

let spelers = [];
let wedstrijden = []; // het schema zoals het is opgeslagen, met verwijzingen
let opgelost = []; // hetzelfde schema met alle bekende namen ingevuld
let tab = 'rondes';
let ingelogd = false;
let beheerder = true; // false = wel ingelogd, maar geen rechten om te wijzigen

const naamVan = (id) => spelers.find((s) => s.id === id)?.naam || '?';
const niveauTekst = (niveau) => (niveau === NIVEAU.ERVAREN ? 'Ervaren' : 'Minder ervaren');
const opNaam = (a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true });

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

// Geeft true terug als de taak gelukt is, anders false (en toont dan de fout)
function inWachtrij(taak) {
  wachtrij = wachtrij.then(taak).then(
    () => true,
    (fout) => {
      const geenRechten = fout.message.includes('row-level security');
      melding(geenRechten ? 'Opslaan geweigerd: dit account heeft geen beheerrechten.' : `Er ging iets mis: ${fout.message}`, true);
      return false;
    }
  );
  return wachtrij;
}

async function laad() {
  [spelers, wedstrijden] = await Promise.all([laadSpelers(), laadWedstrijden()]);
  teken();
}

const ververs = () => inWachtrij(laad);

// ---------- Tab Rondes ----------

// Eén plek in een wedstrijd: een keuzelijst bij een vaste speler,
// of alleen tekst bij een plek die van een uitslag afhangt
function plekHtml(ruw, klaar, plek, plekNaam) {
  if (isVerwijzing(ruw[plek])) return `<div class="vaste-plek">${plekNaam(klaar[plek])}</div>`;
  // Wie in deze ronde al via een uitslag (kan) spelen, is hier niet te kiezen: die zou er dan dubbel in staan
  const bezet = viaUitslag(ruw.ronde);
  const opties = [...spelers]
    .filter((s) => (s.actief && !bezet.has(s.id)) || s.id === ruw[plek])
    .sort(opNaam)
    .map((s) => `<option value="${esc(s.id)}" ${s.id === ruw[plek] ? 'selected' : ''}>${esc(s.naam)}</option>`)
    .join('');
  return `<select data-actie="wissel" data-ronde="${ruw.ronde}" data-speler="${esc(ruw[plek])}" aria-label="Speler">${opties}</select>`;
}

// Spelers die in deze ronde op een plek staan (of kunnen komen) die van een uitslag afhangt
function viaUitslag(ronde) {
  const ids = new Set();
  for (const w of wedstrijden.filter((x) => x.ronde === ronde)) {
    for (const plek of PLEKKEN) {
      if (isVerwijzing(w[plek])) (mogelijkeSpelers(w[plek], opgelost) || []).forEach((id) => ids.add(id));
    }
  }
  return ids;
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

function beheerWedstrijdHtml(ruw, plekNaam) {
  const klaar = opgelost.find((w) => w.id === ruw.id);
  const gelijk = klaar.score1 != null && klaar.score1 === klaar.score2;
  const winnaar = winnaarVan(klaar);
  const puntKnop = (team, a, b) => `
    <button class="knop klein ${winnaar === team ? '' : 'licht'}" data-actie="winnend-punt" data-id="${esc(ruw.id)}" data-team="${team}">
      ${esc(naamVan(a))} &amp; ${esc(naamVan(b))}
    </button>`;

  return `
    <div class="wedstrijd baan-${ruw.baan} ${klaar.compleet ? '' : 'open'}">
      <div class="baan-label">Baan ${ruw.baan}</div>
      <div class="beheer-team">
        ${plekHtml(ruw, klaar, 'team1_a', plekNaam)}${plekHtml(ruw, klaar, 'team1_b', plekNaam)}
        ${klaar.compleet ? teller(klaar, 1) : ''}
      </div>
      <div class="tegen">tegen</div>
      <div class="beheer-team">
        ${plekHtml(ruw, klaar, 'team2_a', plekNaam)}${plekHtml(ruw, klaar, 'team2_b', plekNaam)}
        ${klaar.compleet ? teller(klaar, 2) : ''}
      </div>
      ${klaar.compleet ? '' : '<p class="uitleg">De score kan erin zodra alle vier de namen bekend zijn.</p>'}
      ${
        gelijk
          ? `<div class="winnend-punt">
               Gelijk! Wie won het winnende punt?
               <div class="knoppen">${puntKnop(1, klaar.team1_a, klaar.team1_b)}${puntKnop(2, klaar.team2_a, klaar.team2_b)}</div>
             </div>`
          : ''
      }
      ${
        klaar.score1 != null
          ? `<div class="knoppen"><button class="knop klein gevaar" data-actie="wis-uitslag" data-id="${esc(ruw.id)}">Uitslag wissen</button></div>`
          : ''
      }
    </div>`;
}

function rondeBeheerHtml(ronde, plekNaam) {
  const lijst = vanRonde(ronde, wedstrijden);
  const tijd = tijden.find((t) => t.ronde === ronde);
  const klaar = rondeKlaar(ronde, opgelost);
  const rust = rustSpelers(ronde, spelers, opgelost);

  return `
    <section class="kaart">
      <div class="kaart-kop">
        <h2>Ronde ${ronde} <span class="tijd">${tijd.start} – ${tijd.eind}</span></h2>
        <span class="status ${klaar ? 'klaar' : ''}">${klaar ? 'Klaar' : 'Open'}</span>
      </div>
      ${lijst.map((w) => beheerWedstrijdHtml(w, plekNaam)).join('')}
      ${rust ? `<p class="rust"><strong>Rust:</strong> ${rust.map((s) => esc(s.naam)).join(', ') || 'niemand'}</p>` : ''}
    </section>`;
}

function tekenRondes() {
  if (!wedstrijden.length) {
    return `
      <section class="kaart">
        <div class="kaart-kop"><h2>Schema maken</h2></div>
        <p class="uitleg">Maakt het schema voor alle ${CONFIG.AANTAL_RONDES} rondes in één keer, met de vastgelegde loting.</p>
        <div class="knoppen"><button class="knop" data-actie="schema">Schema maken</button></div>
      </section>`;
  }

  const plekNaam = maakPlekNaam(spelers, opgelost);
  let html = '';
  for (let ronde = 1; ronde <= CONFIG.AANTAL_RONDES; ronde++) html += rondeBeheerHtml(ronde, plekNaam);
  return `
    ${html}
    <section class="kaart">
      <div class="kaart-kop"><h2>Schema aanpassen</h2></div>
      <p class="uitleg">
        Kies bij een speler een andere naam om die twee te wisselen. Dat geldt alleen voor die ronde;
        de andere rondes blijven zoals ze zijn. Kies je iemand die in die ronde rust heeft, dan
        neemt die de plek over.
        Of loot alles opnieuw; daarmee verdwijnen ook de uitslagen.
      </p>
      <div class="knoppen"><button class="knop licht" data-actie="schema" data-loten="ja">Opnieuw loten</button></div>
    </section>`;
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
  const gesorteerd = [...spelers].sort((a, b) => b.actief - a.actief || b.niveau.localeCompare(a.niveau) || opNaam(a, b));

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
      <p class="uitleg">Wist het schema en alle uitslagen. De spelers blijven staan.</p>
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
  opgelost = losOp(wedstrijden);
  document.querySelector('.tabs').hidden = !ingelogd;
  document.getElementById('uitloggen').hidden = !ingelogd || !gebruiktSupabase;
  if (!ingelogd) {
    inhoud.innerHTML = tekenLogin();
    return;
  }
  document.querySelectorAll('[data-tab]').forEach((knop) => knop.classList.toggle('actief', knop.dataset.tab === tab));
  const waarschuwing = beheerder
    ? ''
    : `<section class="kaart waarschuwing">
         <div class="kaart-kop"><h2>Dit account mag nog niets wijzigen</h2></div>
         <p class="uitleg">Je bent ingelogd, maar dit account staat niet in de tabel <strong>beheerders</strong> in Supabase.
         Wijzigingen worden daardoor niet opgeslagen. Voer in de SQL Editor de regel
         <code>insert into beheerders select id from auth.users where email = '...';</code> uit met het e-mailadres
         waarmee je hier bent ingelogd, en ververs daarna deze pagina.</p>
       </section>`;
  inhoud.innerHTML = waarschuwing + (tab === 'rondes' ? tekenRondes() : tekenSpelers());
}

// ---------- Acties ----------

const heeftUitslagen = () => wedstrijden.some((w) => w.score1 != null);

// Loot de spelers en maakt het hele schema
async function maakNieuwSchema(loten) {
  // Opnieuw loten vraagt altijd om bevestiging, zodat een verkeerde tik het schema niet omgooit
  if (loten) {
    const vraag = heeftUitslagen()
      ? 'Opnieuw loten maakt een heel nieuw schema en wist alle uitslagen. Doorgaan?'
      : 'Opnieuw loten maakt een heel nieuw schema. Iedereen ziet dan een andere indeling. Doorgaan?';
    if (!confirm(vraag)) return;
  }
  const { wedstrijden: nieuw, fout } = maakSchema(spelers, loten);
  if (fout) {
    melding(fout, true);
    return;
  }
  const gelukt = await inWachtrij(() => vervangSchema(nieuw));
  await ververs();
  if (gelukt) melding('Het schema is gemaakt.');
}

// Wisselt twee spelers binnen één ronde. De andere rondes blijven zoals ze zijn.
// Speelt spelerB niet in deze ronde, dan neemt die de plek van spelerA over.
async function wissel(ronde, spelerA, spelerB) {
  if (spelerA === spelerB) return;
  if (heeftUitslagen() && !confirm('Er zijn al uitslagen ingevuld. Die blijven bij de wedstrijd staan, ook na het wisselen. Doorgaan?')) {
    teken(); // keuzelijst terugzetten
    return;
  }
  const vanDezeRonde = wedstrijden.filter((w) => w.ronde === ronde);
  const nieuw = wisselSpelers(vanDezeRonde, spelerA, spelerB);
  let gelukt = true;
  for (const w of nieuw) {
    const oud = wedstrijden.find((o) => o.id === w.id);
    if (PLEKKEN.some((plek) => w[plek] !== oud[plek])) {
      const { id, team1_a, team1_b, team2_a, team2_b } = w;
      inWachtrij(() => bewaarWedstrijd({ id, team1_a, team1_b, team2_a, team2_b })).then((ok) => (gelukt = gelukt && ok));
    }
  }
  await ververs();
  if (!gelukt) return;
  const dubbel = dubbelePartners();
  if (dubbel.length) melding(`Gewisseld. Let op: ${dubbel.join(' en ')} spelen nu twee keer samen.`, true);
  else melding(`${naamVan(spelerA)} en ${naamVan(spelerB)} zijn gewisseld in ronde ${ronde}.`);
}

// Koppels die in het schema meer dan één keer samen spelen (alleen de namen die al vaststaan)
function dubbelePartners() {
  const geteld = new Map();
  for (const w of opgelost) {
    for (const [a, b] of [[w.team1_a, w.team1_b], [w.team2_a, w.team2_b]]) {
      if (isVerwijzing(a) || isVerwijzing(b)) continue;
      const sleutel = [a, b].sort().join('|');
      geteld.set(sleutel, (geteld.get(sleutel) || 0) + 1);
    }
  }
  return [...geteld].filter(([, aantal]) => aantal > 1).map(([sleutel]) => sleutel.split('|').map(naamVan).join(' & '));
}

// Verandert de uitslag wie er doorschuift terwijl latere rondes al een uitslag hebben? Dan eerst vragen.
function magUitslagWijzigen(w, nieuw) {
  const voor = winnaarVan(w);
  const na = winnaarVan({ ...w, ...nieuw });
  const laterGespeeld = wedstrijden.some((x) => x.ronde > w.ronde && x.score1 != null);
  if (voor === na || voor === null || !laterGespeeld) return true;
  return confirm('Hierdoor verandert de winnaar, terwijl latere rondes al een uitslag hebben. Daar kunnen dan andere spelers komen te staan. Doorgaan?');
}

// Uitslag aanpassen: meteen op het scherm, opslaan gebeurt op de achtergrond
function zetUitslag(wedstrijdId, nieuw) {
  const w = wedstrijden.find((x) => x.id === wedstrijdId);
  if (!magUitslagWijzigen(w, nieuw)) return;
  Object.assign(w, nieuw);
  teken();
  inWachtrij(() => bewaarWedstrijd({ id: wedstrijdId, ...nieuw }));
}

function pasScoreAan(wedstrijdId, team, delta) {
  const w = wedstrijden.find((x) => x.id === wedstrijdId);
  let score1 = w.score1 ?? 0;
  let score2 = w.score2 ?? 0;
  if (team === 1) score1 = Math.max(0, score1 + delta);
  else score2 = Math.max(0, score2 + delta);
  // Een eerder gekozen winnend punt vervalt zodra de score verandert
  zetUitslag(wedstrijdId, { score1, score2, winnaar: null });
}

async function wijzigSpeler(velden) {
  const gelukt = await inWachtrij(() => bewaarSpeler(velden));
  await ververs();
  return gelukt;
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
  if (actie === 'schema') maakNieuwSchema(knop.dataset.loten === 'ja');
  if (actie === 'score') pasScoreAan(id, Number(knop.dataset.team), Number(knop.dataset.delta));
  if (actie === 'winnend-punt') zetUitslag(id, { winnaar: Number(knop.dataset.team) });
  if (actie === 'wis-uitslag') zetUitslag(id, { score1: null, score2: null, winnaar: null });
  if (actie === 'actief') wijzigSpeler({ id, actief: !spelers.find((s) => s.id === id).actief });
  if (actie === 'reset' && confirm('Het schema en alle uitslagen wissen? Dit kan niet ongedaan worden.')) {
    inWachtrij(resetToernooi).then((gelukt) => ververs().then(() => gelukt && melding('Het toernooi is leeggemaakt.')));
  }
  if (actie === 'uitloggen') {
    uitloggen().then(() => {
      ingelogd = false;
      teken();
    });
  }
});

// Wijzigingen in keuzelijsten en naamvelden
document.addEventListener('change', (e) => {
  const veld = e.target.closest('[data-actie]');
  if (!veld) return;
  const { actie, id } = veld.dataset;

  if (actie === 'wissel') wissel(Number(veld.dataset.ronde), veld.dataset.speler, veld.value);
  if (actie === 'niveau') wijzigSpeler({ id, niveau: veld.value });
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
    const gelukt = await wijzigSpeler({ naam, niveau: gegevens.get('niveau'), actief: true });
    if (gelukt) melding(`${naam} is toegevoegd.`);
  }

  if (e.target.id === 'login') {
    try {
      await inloggen(gegevens.get('email'), gegevens.get('wachtwoord'));
      ingelogd = true;
      beheerder = await isBeheerder();
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
    if (ingelogd) beheerder = await isBeheerder();
  } catch (fout) {
    melding(`Verbinden mislukt: ${fout.message}`, true);
  }
  if (ingelogd) await ververs();
  else teken();
  abonneer(() => ingelogd && ververs());
}

start();
