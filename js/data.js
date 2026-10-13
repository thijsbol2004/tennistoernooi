// Datalaag: alle opslag loopt via dit bestand.
// Zonder Supabase-gegevens in config.js: opslag in de browser (localStorage) met testdata.
// Met Supabase-gegevens: gedeelde database, login en live updates.
import { CONFIG, NIVEAU } from './config.js';

export const gebruiktSupabase = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY);

const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const SLEUTEL_SPELERS = 'tennis_spelers';
const SLEUTEL_WEDSTRIJDEN = 'tennis_wedstrijden';

// ---------- Hulpfuncties Supabase ----------

let client = null;

// Laadt de Supabase-bibliotheek pas als die echt nodig is
async function supabase() {
  if (!client) {
    const { createClient } = await import(SUPABASE_CDN);
    client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  }
  return client;
}

// Gooit een duidelijke fout als een databaseactie mislukt
function controleer({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Hulpfuncties lokaal ----------

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
  if (gebruiktSupabase) {
    const db = await supabase();
    return controleer(await db.from('spelers').select('*').order('naam'));
  }
  let spelers = lees(SLEUTEL_SPELERS);
  if (!spelers) {
    spelers = testSpelers();
    schrijf(SLEUTEL_SPELERS, spelers);
  }
  return spelers;
}

// Voegt een speler toe (zonder id) of werkt een bestaande bij (met id)
export async function bewaarSpeler(speler) {
  if (gebruiktSupabase) {
    const db = await supabase();
    const { id, ...velden } = speler;
    if (id) controleer(await db.from('spelers').update(velden).eq('id', id));
    else controleer(await db.from('spelers').insert(velden));
    return;
  }
  const spelers = await laadSpelers();
  const bestaand = spelers.find((s) => s.id === speler.id);
  if (bestaand) Object.assign(bestaand, speler);
  else spelers.push({ id: nieuwId(), actief: true, doorgeschoven: false, ...speler });
  schrijf(SLEUTEL_SPELERS, spelers);
}

// ---------- Wedstrijden ----------

export async function laadWedstrijden() {
  if (gebruiktSupabase) {
    const db = await supabase();
    return controleer(await db.from('wedstrijden').select('*').order('ronde').order('baan'));
  }
  return lees(SLEUTEL_WEDSTRIJDEN) || [];
}

// Werkt een bestaande wedstrijd bij (id verplicht), bijvoorbeeld de uitslag
export async function bewaarWedstrijd(wedstrijd) {
  const { id, ...velden } = wedstrijd;
  if (gebruiktSupabase) {
    const db = await supabase();
    controleer(await db.from('wedstrijden').update(velden).eq('id', id));
    return;
  }
  const wedstrijden = await laadWedstrijden();
  const bestaand = wedstrijden.find((w) => w.id === id);
  if (bestaand) Object.assign(bestaand, velden);
  schrijf(SLEUTEL_WEDSTRIJDEN, wedstrijden);
}

// Vervangt de hele indeling van één ronde
export async function vervangRonde(ronde, nieuweWedstrijden) {
  if (gebruiktSupabase) {
    const db = await supabase();
    controleer(await db.from('wedstrijden').delete().eq('ronde', ronde));
    if (nieuweWedstrijden.length) {
      controleer(await db.from('wedstrijden').insert(nieuweWedstrijden.map((w) => ({ ...w, ronde }))));
    }
    return;
  }
  const overige = (await laadWedstrijden()).filter((w) => w.ronde !== ronde);
  const nieuw = nieuweWedstrijden.map((w) => ({ id: nieuwId(), ...w, ronde }));
  schrijf(SLEUTEL_WEDSTRIJDEN, [...overige, ...nieuw]);
}

// Wist alle wedstrijden en doorschuivingen, de spelers blijven staan
export async function resetToernooi() {
  if (gebruiktSupabase) {
    const db = await supabase();
    controleer(await db.from('wedstrijden').delete().gte('ronde', 0));
    controleer(await db.from('spelers').update({ doorgeschoven: false }).eq('doorgeschoven', true));
    return;
  }
  const spelers = (await laadSpelers()).map((s) => ({ ...s, doorgeschoven: false }));
  schrijf(SLEUTEL_SPELERS, spelers);
  schrijf(SLEUTEL_WEDSTRIJDEN, []);
}

// ---------- Live updates ----------

// Roept de functie aan zodra er ergens anders iets wijzigt
export async function abonneer(bijWijziging) {
  if (gebruiktSupabase) {
    const db = await supabase();
    db.channel('toernooi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spelers' }, bijWijziging)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wedstrijden' }, bijWijziging)
      .subscribe();
    // Vangnet: ook elke 30 seconden verversen, voor als de live verbinding wegvalt
    setInterval(bijWijziging, 30000);
    return;
  }
  // Lokaal: wijzigingen uit een ander tabblad oppikken
  window.addEventListener('storage', (e) => {
    if (e.key === SLEUTEL_SPELERS || e.key === SLEUTEL_WEDSTRIJDEN) bijWijziging();
  });
}

// ---------- Inloggen ----------

// Lokaal is er geen login nodig
export async function isIngelogd() {
  if (!gebruiktSupabase) return true;
  const db = await supabase();
  const { data } = await db.auth.getSession();
  return Boolean(data.session);
}

export async function inloggen(email, wachtwoord) {
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({ email, password: wachtwoord });
  if (error) throw new Error('Inloggen mislukt. Controleer je e-mailadres en wachtwoord.');
}

export async function uitloggen() {
  if (!gebruiktSupabase) return;
  const db = await supabase();
  await db.auth.signOut();
}
