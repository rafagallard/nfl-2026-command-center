/**
 * Sincronización del calendario NFL 2026 desde el marcador público de ESPN.
 * Este archivo mantiene la pestaña Games separada del API de pronósticos.
 */

/** Define la equivalencia entre las etapas visibles y la numeración de ESPN. */
function getScheduleSlots_() {
  const slots = [{ seasonType: 1, espnWeek: 1, seasonTypeName: "hall-of-fame", week: 0 }];
  [1, 2, 3].forEach(function (week) {
    slots.push({ seasonType: 1, espnWeek: week + 1, seasonTypeName: "preseason", week: week });
  });
  for (let week = 1; week <= 18; week += 1) {
    slots.push({ seasonType: 2, espnWeek: week, seasonTypeName: "regular", week: week });
  }
  [1, 2, 3, 5].forEach(function (week) {
    slots.push({ seasonType: 3, espnWeek: week, seasonTypeName: "postseason", week: week });
  });
  return slots;
}

/** Normaliza abreviaciones que difieren entre ESPN y la base interna. */
function normalizeTeamId_(abbreviation) {
  const aliases = { JAC: "jax", WSH: "was", LA: "lar" };
  return aliases[abbreviation] || String(abbreviation || "").toLowerCase();
}

/** Descarga JSON con encabezados de navegador y reintentos cortos. */
function fetchEspnJson_(url, label) {
  const attempts = 3;
  let lastCode = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (compatible; NFLTracker2026/1.0)",
      },
    });
    lastCode = response.getResponseCode();
    if (lastCode === 200) return JSON.parse(response.getContentText());
    if ([403, 429, 500, 502, 503, 504].indexOf(lastCode) === -1) break;
    if (attempt < attempts) Utilities.sleep(attempt * 1200);
  }
  throw new Error("ESPN respondió " + lastCode + " al consultar " + label + ".");
}

/** Descarga una etapa y transforma cada evento al esquema de la pestaña Games. */
function fetchScheduleSlot_(slot) {
  const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard" +
    "?seasontype=" + slot.seasonType + "&week=" + slot.espnWeek + "&dates=2026&limit=100";
  const payload = fetchEspnJson_(url, "calendario " + slot.seasonTypeName + " semana " + slot.week);

  return (payload.events || []).map(function (event) {
    const competition = event.competitions && event.competitions[0];
    if (!competition) return null;
    const home = competition.competitors.find(function (team) { return team.homeAway === "home"; });
    const away = competition.competitors.find(function (team) { return team.homeAway === "away"; });
    if (!home || !away) return null;
    const state = event.status && event.status.type && event.status.type.state;
    const homeScore = home.score === undefined || home.score === "" ? "" : Number(home.score);
    const awayScore = away.score === undefined || away.score === "" ? "" : Number(away.score);
    let winnerTeamId = "";
    if (state === "post" && homeScore !== awayScore) winnerTeamId = homeScore > awayScore ? normalizeTeamId_(home.team.abbreviation) : normalizeTeamId_(away.team.abbreviation);

    return {
      game_id: String(event.id), season: 2026, season_type: slot.seasonTypeName, week: slot.week,
      kickoff_utc: new Date(event.date), away_team_id: normalizeTeamId_(away.team.abbreviation),
      home_team_id: normalizeTeamId_(home.team.abbreviation),
      venue: (competition.venue && competition.venue.fullName) || "TBD",
      status: state === "post" ? "final" : state === "in" ? "live" : "scheduled",
      away_score: awayScore, home_score: homeScore, winner_team_id: winnerTeamId,
      source_url: url, updated_at: new Date(),
    };
  }).filter(Boolean);
}

/**
 * Actualiza únicamente partidos cercanos a su kickoff mediante el endpoint de
 * resumen por game_id. Así el proceso horario no vuelve a solicitar 26 semanas.
 */
function syncRecentGameStatuses2026() {
  const table = readTable_(APP.sheets.games);
  const now = Date.now();
  const windowStart = now - 3 * 86400000;
  const windowEnd = now + 2 * 86400000;
  const errors = [];
  let updated = 0;

  table.rows.forEach(function (row) {
    const gameIdIndex = table.headers.indexOf("game_id");
    const kickoffIndex = table.headers.indexOf("kickoff_utc");
    const kickoff = new Date(row[kickoffIndex]).getTime();
    if (!isFinite(kickoff) || kickoff < windowStart || kickoff > windowEnd) return;

    const gameId = String(row[gameIdIndex]);
    const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=" + gameId;
    try {
      const payload = fetchEspnJson_(url, "partido " + gameId);
      const competition = payload.header && payload.header.competitions && payload.header.competitions[0];
      if (!competition) throw new Error("El resumen no contiene competition.");
      const home = (competition.competitors || []).find(function (team) { return team.homeAway === "home"; });
      const away = (competition.competitors || []).find(function (team) { return team.homeAway === "away"; });
      if (!home || !away) throw new Error("El resumen no contiene ambos equipos.");
      const state = competition.status && competition.status.type && competition.status.type.state;
      const homeScore = Number(home.score || 0);
      const awayScore = Number(away.score || 0);
      let winnerTeamId = "";
      if (state === "post" && homeScore !== awayScore) {
        winnerTeamId = homeScore > awayScore ? normalizeTeamId_(home.team.abbreviation) : normalizeTeamId_(away.team.abbreviation);
      }
      row[table.headers.indexOf("status")] = state === "post" ? "final" : state === "in" ? "live" : "scheduled";
      row[table.headers.indexOf("away_score")] = awayScore;
      row[table.headers.indexOf("home_score")] = homeScore;
      row[table.headers.indexOf("winner_team_id")] = winnerTeamId;
      row[table.headers.indexOf("source_url")] = url;
      row[table.headers.indexOf("updated_at")] = new Date();
      updated += 1;
    } catch (error) {
      errors.push(gameId + ": " + String(error.message || error));
    }
  });

  if (updated) table.sheet.getRange(2, 1, table.rows.length, table.headers.length).setValues(table.rows);
  if (!updated && errors.length) throw new Error(errors.join(" | "));
  return { gamesRead: updated + errors.length, gamesUpdated: updated, errors: errors };
}

/**
 * Descarga el calendario completo y reemplaza únicamente el contenido de Games.
 * La escritura se realiza una sola vez para evitar estados parcialmente actualizados.
 */
function syncFullSchedule2026() {
  const table = readTable_(APP.sheets.games);
  const recordsById = {};
  getScheduleSlots_().forEach(function (slot) {
    fetchScheduleSlot_(slot).forEach(function (game) { recordsById[game.game_id] = game; });
  });
  const records = Object.keys(recordsById).map(function (gameId) { return recordsById[gameId]; });
  records.sort(function (left, right) { return left.kickoff_utc.getTime() - right.kickoff_utc.getTime(); });
  if (!records.length) throw new Error("La fuente no devolvió partidos; Games no fue modificada.");

  const rows = records.map(function (record) {
    return table.headers.map(function (header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ""; });
  });
  const currentRows = Math.max(0, table.sheet.getLastRow() - 1);
  if (currentRows) table.sheet.getRange(2, 1, currentRows, table.headers.length).clearContent();
  table.sheet.getRange(2, 1, rows.length, table.headers.length).setValues(rows);
  table.sheet.getRange(2, table.headers.indexOf("kickoff_utc") + 1, rows.length, 1).setNumberFormat("yyyy-mm-dd hh:mm");
  table.sheet.getRange(2, table.headers.indexOf("updated_at") + 1, rows.length, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  console.log(JSON.stringify({ ok: true, gamesImported: rows.length, updatedAt: new Date().toISOString() }, null, 2));
}
