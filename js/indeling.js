// Maakt de indeling per ronde en het doorschuifvoorstel.
import { CONFIG, NIVEAU } from './config.js';
import { berekenStand, spelersVan } from './stand.js';

// Vaste sleutel voor een tweetal, ongeacht de volgorde
const sleutel = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Alle tweetallen die al eens samen een team vormden
export function partnerParen(wedstrijden) {
  const paren = new Set();
  for (const w of wedstrijden) {
    if (w.team1_a && w.team1_b) paren.add(sleutel(w.team1_a, w.team1_b));
    if (w.team2_a && w.team2_b) paren.add(sleutel(w.team2_a, w.team2_b));
  }
  return paren;
}

// Hoe vaak twee spelers al tegenover elkaar stonden
function tegenstanderTelling(wedstrijden) {
  const telling = new Map();
  for (const w of wedstrijden) {
    for (const a of [w.team1_a, w.team1_b]) {
      for (const b of [w.team2_a, w.team2_b]) {
        if (!a || !b) continue;
        telling.set(sleutel(a, b), (telling.get(sleutel(a, b)) || 0) + 1);
      }
    }
  }
  return telling;
}

// Per speler: hoe vaak ingedeeld en in welke ronde voor het laatst
function speelInfo(wedstrijden) {
  const info = new Map();
  for (const w of wedstrijden) {
    for (const id of spelersVan(w)) {
      if (!id) continue;
      const huidig = info.get(id) || { gespeeld: 0, laatsteRonde: 0 };
      huidig.gespeeld += 1;
      huidig.laatsteRonde = Math.max(huidig.laatsteRonde, w.ronde);
      info.set(id, huidig);
    }
  }
  return info;
}

// Welke spelers horen in deze ronde op welke baan
export function poolsVoorRonde(ronde, spelers) {
  const actief = spelers.filter((s) => s.actief);
  const gescheiden = ronde <= CONFIG.GESCHEIDEN_RONDES;
  const opBaan1 = (s) => s.niveau === NIVEAU.ERVAREN || (!gescheiden && s.doorgeschoven);
  return {
    1: actief.filter(opBaan1),
    2: actief.filter((s) => !opBaan1(s)),
  };
}

// De drie manieren om vier spelers in twee teams te verdelen
function verdelingen([a, b, c, d]) {
  return [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ];
}

// Zoekt de beste wedstrijd voor één baan.
// Kandidaten: [{ id, extra }] waarbij extra = aanvulling vanaf de andere baan.
function besteWedstrijd(kandidaten, hulp) {
  const { info, paren, tegenstanders, kracht } = hulp;
  let beste = null;

  const n = kandidaten.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        for (let l = k + 1; l < n; l++) {
          const vier = [kandidaten[i], kandidaten[j], kandidaten[k], kandidaten[l]];

          // Voorrang: wie het minst speelde, daarna wie het langst rust had
          let keuzeKosten = 0;
          for (const s of vier) {
            const { gespeeld, laatsteRonde } = info.get(s.id) || { gespeeld: 0, laatsteRonde: 0 };
            keuzeKosten += gespeeld * 100 + laatsteRonde + (s.extra ? 1000 : 0);
          }

          for (const [team1, team2] of verdelingen(vier.map((s) => s.id))) {
            // Harde regel: nooit twee keer dezelfde partner
            if (paren.has(sleutel(...team1)) || paren.has(sleutel(...team2))) continue;

            // Teams even sterk maken: zo komt de winnaar naast de verliezer
            const verschil = Math.abs(
              kracht(team1[0]) + kracht(team1[1]) - kracht(team2[0]) - kracht(team2[1])
            );

            // Liever geen tegenstanders die elkaar al troffen
            let herhaling = 0;
            for (const a of team1) for (const b of team2) herhaling += tegenstanders.get(sleutel(a, b)) || 0;

            // Klein beetje toeval, zodat gelijke opties geloot worden
            const kosten = keuzeKosten * 10 + verschil + herhaling * 0.1 + Math.random() * 0.01;
            if (!beste || kosten < beste.kosten) beste = { kosten, team1, team2 };
          }
        }

  return beste;
}

// Genereert een voorstel voor één ronde.
// Geeft terug: { wedstrijden, rust (speler-id's), waarschuwingen }
export function genereerRonde(ronde, spelers, wedstrijden) {
  // Bestaande wedstrijden van deze ronde tellen niet mee, die worden vervangen
  const andere = wedstrijden.filter((w) => w.ronde !== ronde);

  const stand = new Map(berekenStand(spelers, andere).map((r) => [r.id, r]));
  const hulp = {
    info: speelInfo(andere),
    paren: partnerParen(andere),
    tegenstanders: tegenstanderTelling(andere),
    // Sterkte op basis van de tussenstand; zonder wedstrijden neutraal
    kracht: (id) => {
      const r = stand.get(id);
      return r && r.gespeeld ? r.winstPct + r.gemSaldo / 20 : 0.5;
    },
  };

  const pools = poolsVoorRonde(ronde, spelers);
  const actief = spelers.filter((s) => s.actief);
  const bezet = new Set();
  const nieuw = [];
  const waarschuwingen = [];

  for (const baan of [1, 2]) {
    let kandidaten = pools[baan].filter((s) => !bezet.has(s.id)).map((s) => ({ id: s.id, extra: false }));

    // Te weinig spelers voor deze baan: aanvullen met spelers van de andere baan
    if (kandidaten.length < 4) {
      const eigen = new Set(kandidaten.map((k) => k.id));
      const aanvulling = actief
        .filter((s) => !bezet.has(s.id) && !eigen.has(s.id))
        .map((s) => ({ id: s.id, extra: true }));
      kandidaten = [...kandidaten, ...aanvulling];
    }

    const beste = besteWedstrijd(kandidaten, hulp);
    if (!beste) {
      waarschuwingen.push(`Baan ${baan}: geen indeling mogelijk zonder dubbele partners of te weinig spelers.`);
      continue;
    }

    [...beste.team1, ...beste.team2].forEach((id) => bezet.add(id));
    nieuw.push({
      ronde,
      baan,
      team1_a: beste.team1[0],
      team1_b: beste.team1[1],
      team2_a: beste.team2[0],
      team2_b: beste.team2[1],
      score1: null,
      score2: null,
      winnaar: null,
    });
  }

  const rust = actief.filter((s) => !bezet.has(s.id)).map((s) => s.id);
  return { wedstrijden: nieuw, rust, waarschuwingen };
}

// Controleert een (handmatig aangepaste) ronde. Geeft een lijst met fouten terug.
export function controleerRonde(ronde, rondeWedstrijden, wedstrijden, spelers) {
  const naam = (id) => spelers.find((s) => s.id === id)?.naam || 'Onbekend';
  const paren = partnerParen(wedstrijden.filter((w) => w.ronde !== ronde));
  const fouten = [];
  const gezien = new Set();

  for (const w of rondeWedstrijden) {
    const ids = spelersVan(w);
    if (ids.some((id) => !id)) {
      fouten.push(`Baan ${w.baan}: niet alle vier de plekken zijn gevuld.`);
      continue;
    }
    for (const id of ids) {
      if (gezien.has(id)) fouten.push(`${naam(id)} staat twee keer in deze ronde.`);
      gezien.add(id);
    }
    for (const [a, b] of [[w.team1_a, w.team1_b], [w.team2_a, w.team2_b]]) {
      if (paren.has(sleutel(a, b))) fouten.push(`${naam(a)} en ${naam(b)} waren al eerder partners.`);
    }
  }
  return fouten;
}

// Stelt de best presterende minder ervaren spelers voor om door te schuiven
export function doorschuifVoorstel(spelers, wedstrijden, aantal = CONFIG.AANTAL_DOORSCHUIVEN) {
  return berekenStand(spelers, wedstrijden)
    .filter((r) => r.niveau === NIVEAU.BEGINNER && r.actief && r.gespeeld > 0)
    .slice(0, aantal)
    .map((r) => r.id);
}
