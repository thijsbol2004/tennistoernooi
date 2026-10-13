// Het vaste toernooischema voor 7 ervaren en 7 minder ervaren spelers.
// Het hele schema wordt in één keer gemaakt. Plekken die van een uitslag afhangen
// zijn verwijzingen ("de winnaar van ronde 1, baan 2") en vullen zichzelf in
// zodra die uitslag is ingevoerd.
import { CONFIG, NIVEAU } from './config.js';
import { winnaarVan } from './stand.js';

// De vier plekken van een wedstrijd: team 1 (a en b) en team 2 (a en b)
export const PLEKKEN = ['team1_a', 'team1_b', 'team2_a', 'team2_b'];

// Verwijzing naar de winnaar (W) of verliezer (L) van een eerdere wedstrijd.
// plek 0 = de eerste speler van dat team, plek 1 = de tweede.
const W = (ronde, baan, plek) => `@W:${ronde}:${baan}:${plek}`;
const L = (ronde, baan, plek) => `@L:${ronde}:${baan}:${plek}`;

// E1-E7 = ervaren spelers, B1-B7 = minder ervaren spelers (worden geloot).
// Per regel: ronde, baan, team 1 (2 plekken), team 2 (2 plekken).
// Regel van het toernooi: wie op baan 2 wint, speelt de ronde erna op baan 1.
const SJABLOON = [
  [1, 1, 'E1', 'E2', 'E3', 'E4'],
  [1, 2, 'B1', 'B2', 'B3', 'B4'],
  [2, 1, 'E5', W(1, 2, 0), 'E6', W(1, 2, 1)],
  [2, 2, 'B5', 'B6', 'B7', L(1, 2, 0)],
  [3, 1, 'E7', W(2, 2, 0), 'E1', W(2, 2, 1)],
  [3, 2, L(1, 2, 1), L(2, 2, 0), L(2, 2, 1), W(1, 2, 0)],
  [4, 1, 'E2', 'E3', 'E4', 'E5'],
  [4, 2, 'E6', W(2, 2, 0), 'E7', W(1, 2, 1)],
];

export const isVerwijzing = (waarde) => typeof waarde === 'string' && waarde.startsWith('@');

// Haalt een verwijzing uit elkaar, bijv. '@W:1:2:0'
export function leesVerwijzing(waarde) {
  const [soort, ronde, baan, plek] = waarde.slice(1).split(':');
  return { wint: soort === 'W', ronde: Number(ronde), baan: Number(baan), plek: Number(plek) };
}

// Zet een lijst in willekeurige volgorde
function schud(lijst) {
  return lijst
    .map((item) => [Math.random(), item])
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
}

// Zet de spelers in de volgorde van de vaste loting.
// Geeft null als de namen niet precies overeenkomen (dan wordt er geloot).
function inVasteVolgorde(groep, namen) {
  if (!namen || namen.length !== groep.length) return null;
  const opVolgorde = namen.map((naam) => groep.find((s) => s.naam === naam));
  return opVolgorde.every(Boolean) ? opVolgorde : null;
}

// Maakt het hele schema. Geeft { wedstrijden } terug, of { fout } als de aantallen niet kloppen.
// loten = true: willekeurige loting. Anders de vaste loting uit config.js, als die past.
export function maakSchema(spelers, loten = false) {
  const actief = spelers.filter((s) => s.actief);
  let ervaren = actief.filter((s) => s.niveau === NIVEAU.ERVAREN);
  let beginners = actief.filter((s) => s.niveau === NIVEAU.BEGINNER);

  const vast = CONFIG.VASTE_LOTING || {};
  ervaren = (!loten && inVasteVolgorde(ervaren, vast.ervaren)) || schud(ervaren);
  beginners = (!loten && inVasteVolgorde(beginners, vast.minderErvaren)) || schud(beginners);

  if (ervaren.length !== 7 || beginners.length !== 7) {
    return {
      fout: `Het schema is gemaakt voor 7 ervaren en 7 minder ervaren spelers. Nu zijn dat er ${ervaren.length} en ${beginners.length}.`,
    };
  }

  // Vervangt E1, B3 enzovoort door een echte speler; verwijzingen blijven staan
  const vul = (code) => {
    if (isVerwijzing(code)) return code;
    const groep = code[0] === 'E' ? ervaren : beginners;
    return groep[Number(code.slice(1)) - 1].id;
  };

  const wedstrijden = SJABLOON.map(([ronde, baan, a, b, c, d]) => ({
    ronde,
    baan,
    team1_a: vul(a),
    team1_b: vul(b),
    team2_a: vul(c),
    team2_b: vul(d),
    score1: null,
    score2: null,
    winnaar: null,
  }));
  return { wedstrijden };
}

// Vult alle verwijzingen in waarvan de uitslag bekend is.
// Geeft kopieën terug met een extra veld: compleet = alle vier de namen zijn bekend.
export function losOp(wedstrijden) {
  const opVolgorde = [...wedstrijden].sort((a, b) => a.ronde - b.ronde || a.baan - b.baan);
  const klaar = [];

  for (const w of opVolgorde) {
    const kopie = { ...w };
    for (const plek of PLEKKEN) {
      if (!isVerwijzing(w[plek])) continue;
      const v = leesVerwijzing(w[plek]);
      const bron = klaar.find((k) => k.ronde === v.ronde && k.baan === v.baan);
      const winnaar = bron && bron.compleet ? winnaarVan(bron) : null;
      if (winnaar === null) continue; // uitslag nog niet bekend
      const team = v.wint ? winnaar : 3 - winnaar;
      kopie[plek] = bron[`team${team}_${v.plek === 0 ? 'a' : 'b'}`];
    }
    kopie.compleet = PLEKKEN.every((plek) => !isVerwijzing(kopie[plek]));
    klaar.push(kopie);
  }
  return klaar;
}

// Alle spelers die op een nog open plek kunnen komen (of null als dat niet te zeggen is).
// Meestal twee; drie als een van de kandidaten zelf nog van een uitslag afhangt.
export function mogelijkeSpelers(verwijzing, opgelost) {
  const v = leesVerwijzing(verwijzing);
  const bron = opgelost.find((w) => w.ronde === v.ronde && w.baan === v.baan);
  if (!bron) return null;
  const letter = v.plek === 0 ? 'a' : 'b';
  const kandidaten = [];
  for (const waarde of [bron[`team1_${letter}`], bron[`team2_${letter}`]]) {
    const dieper = isVerwijzing(waarde) ? mogelijkeSpelers(waarde, opgelost) : [waarde];
    if (!dieper) return null;
    kandidaten.push(...dieper);
  }
  return [...new Set(kandidaten)];
}

// Wisselt twee spelers in de meegegeven wedstrijden (beheer geeft alleen die van één ronde mee)
export function wisselSpelers(wedstrijden, spelerA, spelerB) {
  const ruil = (id) => (id === spelerA ? spelerB : id === spelerB ? spelerA : id);
  return wedstrijden.map((w) => {
    const kopie = { ...w };
    for (const plek of PLEKKEN) kopie[plek] = ruil(w[plek]);
    return kopie;
  });
}
