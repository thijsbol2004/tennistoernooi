// Instellingen van het toernooi. Alles wat je wilt aanpassen staat hier.
export const CONFIG = {
  // Supabase-koppeling. Leeg laten = de app werkt lokaal met testdata.
  // Dit is de publieke sleutel; die mag in de code staan.
  SUPABASE_URL: 'https://qveetnojychbrworryak.supabase.co',
  SUPABASE_KEY: 'sb_publishable_fJswGIwqXC41guh_zOHgIA_MsSCdVD-',

  TOERNOOI_NAAM: 'DoubleTennistoernooi',

  // Tijden
  START_INSPELEN: '16:00',
  START_RONDE_1: '16:15',
  SPEELTIJD: 25, // minuten per ronde
  WISSELTIJD: 5, // minuten tussen de rondes

  // Het schema zelf staat in js/indeling.js (SJABLOON)
  AANTAL_RONDES: 4,

  // De gekozen loting: de volgorde bepaalt wie op welke plek in het schema staat.
  // "Schema maken" gebruikt deze volgorde, "Opnieuw loten" kiest een willekeurige.
  VASTE_LOTING: {
    ervaren: ['Stijn', 'Remco', 'Thijs', 'Demi', 'Jesse', 'Sjoerd', 'Bart'],
    minderErvaren: ['Hein', 'Max', 'Lorenzo', 'Harvey', 'Kim', 'Isis', 'Steven'],
  },
};

// De twee niveaus zoals ze in de database staan
export const NIVEAU = {
  ERVAREN: 'ervaren',
  BEGINNER: 'beginner',
};

// Zet 'uu:mm' om naar minuten sinds middernacht
function naarMinuten(tijd) {
  const [uur, minuut] = tijd.split(':').map(Number);
  return uur * 60 + minuut;
}

// Zet minuten sinds middernacht om naar 'uu:mm'
function naarTijd(minuten) {
  const uur = String(Math.floor(minuten / 60)).padStart(2, '0');
  const minuut = String(minuten % 60).padStart(2, '0');
  return `${uur}:${minuut}`;
}

// Geeft per ronde de start- en eindtijd, bijv. { ronde: 1, start: '16:15', eind: '16:40' }
export function rondeTijden() {
  const tijden = [];
  let start = naarMinuten(CONFIG.START_RONDE_1);
  for (let ronde = 1; ronde <= CONFIG.AANTAL_RONDES; ronde++) {
    tijden.push({ ronde, start: naarTijd(start), eind: naarTijd(start + CONFIG.SPEELTIJD) });
    start += CONFIG.SPEELTIJD + CONFIG.WISSELTIJD;
  }
  return tijden;
}
