// Berekent de ranglijst uit de gespeelde wedstrijden.

// De vier spelers van een wedstrijd: eerst team 1, dan team 2
export function spelersVan(w) {
  return [w.team1_a, w.team1_b, w.team2_a, w.team2_b];
}

// Welk team heeft gewonnen: 1, 2 of null (nog geen uitslag).
// Bij een gelijke stand telt het winnende punt, dat staat in w.winnaar.
export function winnaarVan(w) {
  if (w.score1 == null || w.score2 == null) return null;
  if (w.score1 > w.score2) return 1;
  if (w.score2 > w.score1) return 2;
  return w.winnaar ?? null;
}

// Geeft de ranglijst terug, beste speler eerst.
// Volgorde: winstpercentage, gemiddeld gamesaldo, gemiddeld gewonnen games,
// daarna het onderling resultaat. Is dat ook gelijk, dan delen spelers een plek.
export function berekenStand(spelers, wedstrijden) {
  const rijen = new Map();
  for (const s of spelers) {
    rijen.set(s.id, {
      id: s.id,
      naam: s.naam,
      niveau: s.niveau,
      actief: s.actief,
      gespeeld: 0,
      gewonnen: 0,
      verloren: 0,
      gamesVoor: 0,
      gamesTegen: 0,
    });
  }

  for (const w of wedstrijden) {
    const winnaar = winnaarVan(w);
    if (winnaar === null) continue; // nog niet (volledig) ingevuld

    spelersVan(w).forEach((id, index) => {
      const rij = rijen.get(id);
      if (!rij) return;
      const team = index < 2 ? 1 : 2;
      rij.gespeeld += 1;
      rij.gamesVoor += team === 1 ? w.score1 : w.score2;
      rij.gamesTegen += team === 1 ? w.score2 : w.score1;
      if (team === winnaar) rij.gewonnen += 1;
      else rij.verloren += 1;
    });
  }

  // Afgemelde spelers zonder wedstrijden laten we weg
  const stand = [...rijen.values()].filter((r) => r.actief || r.gespeeld > 0);

  for (const r of stand) {
    r.winstPct = r.gespeeld ? r.gewonnen / r.gespeeld : 0;
    r.gemSaldo = r.gespeeld ? (r.gamesVoor - r.gamesTegen) / r.gespeeld : 0;
    r.gemVoor = r.gespeeld ? r.gamesVoor / r.gespeeld : 0;
  }

  // Hebben twee spelers exact dezelfde cijfers?
  const zelfdeCijfers = (a, b) =>
    a.gespeeld > 0 === b.gespeeld > 0 &&
    a.winstPct === b.winstPct &&
    a.gemSaldo === b.gemSaldo &&
    a.gemVoor === b.gemVoor;
  const opNaam = (a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true });

  stand.sort(
    (a, b) =>
      (b.gespeeld > 0) - (a.gespeeld > 0) || // wie nog niet speelde staat onderaan
      b.winstPct - a.winstPct ||
      b.gemSaldo - a.gemSaldo ||
      b.gemVoor - a.gemVoor ||
      opNaam(a, b)
  );

  // Spelers met dezelfde cijfers: het onderling resultaat beslist.
  // onderling = aantal keer gewonnen van iemand uit hetzelfde groepje.
  for (const r of stand) r.onderling = 0;
  let begin = 0;
  while (begin < stand.length) {
    let eind = begin + 1;
    while (eind < stand.length && zelfdeCijfers(stand[begin], stand[eind])) eind++;
    const groep = stand.slice(begin, eind);

    if (groep.length > 1 && groep[0].gespeeld > 0) {
      const inGroep = new Set(groep.map((r) => r.id));
      for (const w of wedstrijden) {
        const winnaar = winnaarVan(w);
        if (winnaar === null) continue;
        const team1 = [w.team1_a, w.team1_b];
        const team2 = [w.team2_a, w.team2_b];
        const winnaars = winnaar === 1 ? team1 : team2;
        const verliezers = winnaar === 1 ? team2 : team1;
        if (!verliezers.some((id) => inGroep.has(id))) continue;
        for (const id of winnaars) if (inGroep.has(id)) rijen.get(id).onderling += 1;
      }
      groep.sort((a, b) => b.onderling - a.onderling || opNaam(a, b));
      stand.splice(begin, groep.length, ...groep);
    }
    begin = eind;
  }

  // Rangnummer: is ook het onderling resultaat gelijk, dan delen spelers een plek
  stand.forEach((r, i) => {
    const vorige = stand[i - 1];
    const gedeeld = vorige && zelfdeCijfers(vorige, r) && vorige.onderling === r.onderling;
    r.rang = gedeeld ? vorige.rang : i + 1;
  });

  return stand;
}
