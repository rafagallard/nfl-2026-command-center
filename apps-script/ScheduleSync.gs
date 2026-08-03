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

/** Descarga una etapa y transforma cada evento al esquema de la pestaña Games. */
function fetchScheduleSlot_(slot) {
  const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard" +
    "?seasontype=" + slot.seasonType + "&week=" + slot.espnWeek + "&dates=2026&limit=100";
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error("ESPN respondió " + response.getResponseCode() + " para " + url);
  const payload = JSON.parse(response.getContentText());

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
