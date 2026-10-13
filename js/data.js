// Datalaag: alle opslag loopt via dit bestand.
// Nu: opslag in de browser (localStorage) met testdata.
// Later (stap 4): Supabase, zodra CONFIG.SUPABASE_URL en CONFIG.SUPABASE_KEY zijn ingevuld.
import { CONFIG, NIVEAU } from './config.js';

export const gebruiktSupabase = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY);

const SLEUTEL_SPELERS = 'tennis_spelers';
const SLEUTEL_WEDSTRIJDEN = 'tennis_wedstrijden';

// 14 testspelers: 6 ervaren en 8 minder ervaren
function testSpelers() {
  return Array.from({ length: 14 }, (_, i) => ({
    id: `test-${i + 1}`,
    naam: i < 6 ? `Ervaren ${i + 1}` : `Speler ${i + 1}`,
    niveau: i < 6 ? NIVEAU.ERVAREN : NIVEAU.BEGINNER,
    actief: true,
    doorgeschoven: false,
  }));
}

function lees(sleutel) {
  try {
    return JSON.parse(localStorage.getItem(sleutel));
  } catch {
    return null;
  }
}

function schrijf(sleutel, waarde) {
  localStorage.setItem(sleutel, JSON.stringify(waarde));
}

const nieuwId = () => crypto.randomUUID();

// ---------- Spelers ----------

export async function laadSpelers() {
  let spelers = lees(SLEUTEL_SPELERS);
  if (!spelers) {
    spelers = testSpelers();
    schrijf(SLEUTEL_SPELERS, spelers);
  }
  return spelers;
}

// Voegt een speler toe of werkt een bestaande bij (op basis van id)
export async function bewaarSpeler(speler) {
  const spelers = await laadSpelers();
  const bestaand = spelers.find((s) => s.id === speler.id);
  if (bestaand) Object.assign(bestaand, speler);
  else spelers.push({ id: nieuwId(), actief: true, doorgeschoven: false, ...speler });
  schrijf(SLEUTEL_SPELERS, spelers);
}

// ---------- Wedstrijden ----------

export async function laadWedstrijden() {
  return lees(SLEUTEL_WEDSTRIJDEN) || [];
}

// Voegt een wedstrijd toe of werkt een bestaande bij (op basis van id)
export async function bewaarWedstrijd(wedstrijd) {
  const wedstrijden = await laadWedstrijden();
  const bestaand = wedstrijden.find((w) => w.id === wedstrijd.id);
  if (bestaand) Object.assign(bestaand, wedstrijd);
  else wedstrijden.push({ id: nieuwId(), ...wedstrijd });
  schrijf(SLEUTEL_WEDSTRIJDEN, wedstrijden);
}

// Vervangt de hele indeling van één ronde
export async function vervangRonde(ronde, nieuweWedstrijden) {
  const overige = (await laadWedstrijden()).filter((w) => w.ronde !== ronde);
  const nieuw = nieuweWedstrijden.map((w) => ({ id: nieuwId(), ...w, ronde }));
  schrijf(SLEUTEL_WEDSTRIJDEN, [...overige, ...nieuw]);
}

// Wist alle wedstrijden en doorschuivingen, de spelers blijven staan
export async function resetToernooi() {
  const spelers = (await laadSpelers()).map((s) => ({ ...s, doorgeschoven: false }));
  schrijf(SLEUTEL_SPELERS, spelers);
  schrijf(SLEUTEL_WEDSTRIJDEN, []);
}

// ---------- Live updates ----------

// Roept de functie aan zodra er in een ander tabblad iets wijzigt
export function abonneer(bijWijziging) {
  window.addEventListener('storage', (e) => {
    if (e.key === SLEUTEL_SPELERS || e.key === SLEUTEL_WEDSTRIJDEN) bijWijziging();
  });
}

// ---------- Inloggen ----------

// Lokaal is er geen login nodig; met Supabase wordt dit de echte login
export async function isIngelogd() {
  return !gebruiktSupabase;
}
