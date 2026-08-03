/**
 * Backend compartido para NFL 2026 Command Center.
 *
 * El proyecto se publica como aplicación web y usa Google Sheets como base
 * histórica. Todas las validaciones importantes se repiten en el servidor para
 * que no puedan omitirse modificando el frontend.
 */
const APP = Object.freeze({
  spreadsheetId: "145d64hKoIZFIUobAFD-RxmS_F_DB5eO298Tq0YGbKbs",
  season: 2026,
  sheets: Object.freeze({ games: "Games", predictions: "Predictions" }),
});

/** Agrega al abrir la hoja un menú con tareas operativas del proyecto. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("NFL 2026")
    .addItem("Comprobar backend", "testBackend")
    .addItem("Sincronizar calendario 2026", "syncSchedule2026")
    .addToUi();
}

/** Normaliza nombres para bloquear duplicados por mayúsculas, acentos o espacios. */
function normalizeParticipantName_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Convierte una fila en un objeto usando los encabezados de la hoja. */
function rowToObject_(headers, row) {
  return headers.reduce(function (record, header, index) {
    record[header] = row[index] instanceof Date ? row[index].toISOString() : row[index];
    return record;
  }, {});
}

/** Lee una hoja tabular y devuelve encabezados, filas y objetos. */
function readTable_(sheetName) {
  const sheet = SpreadsheetApp.openById(APP.spreadsheetId).getSheetByName(sheetName);
  if (!sheet) throw new Error("No existe la pestaña requerida: " + sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() || [];
  return { sheet: sheet, headers: headers, rows: values, records: values.map(function (row) { return rowToObject_(headers, row); }) };
}

/** Construye respuestas JSON consistentes para el frontend. */
function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Atiende lecturas de salud, calendario e historial de pronósticos. */
function doGet(event) {
  try {
    const parameters = (event && event.parameter) || {};
    const action = parameters.action || "health";
    if (action === "health") return jsonResponse_({ ok: true, service: "nfl-2026-backend", season: APP.season, serverTime: new Date().toISOString() });
    if (action === "games") return jsonResponse_({ ok: true, games: getGames_(parameters) });
    if (action === "predictions") return jsonResponse_({ ok: true, predictions: getPredictions_(parameters) });
    if (action === "plays") return jsonResponse_({ ok: true, plays: getPlays_(parameters) });
    return jsonResponse_({ ok: false, error: "unsupported_action" });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: "server_error", message: String(error.message || error) });
  }
}

/** Devuelve jugadas enriquecidas con su explicación técnica bilingüe. */
function getPlays_(parameters) {
  const tags = readTable_("Play_Tags").records.reduce(function (map, tag) {
    map[String(tag.play_id)] = tag;
    return map;
  }, {});
  return readTable_("Play_By_Play").records
    .filter(function (play) {
      const gameMatches = !parameters.gameId || String(play.game_id) === String(parameters.gameId);
      const teamMatches = !parameters.teamId || String(play.possession_team_id) === String(parameters.teamId);
      const quarterMatches = !parameters.quarter || Number(play.quarter) === Number(parameters.quarter);
      const typeMatches = !parameters.playType || String(play.play_type) === String(parameters.playType);
      return gameMatches && teamMatches && quarterMatches && typeMatches;
    })
    .map(function (play) {
      play.tags = tags[String(play.play_id)] || {};
      return play;
    });
}

/** Atiende escrituras; por ahora sólo se permite registrar pronósticos. */
function doPost(event) {
  try {
    const body = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    if ((body.action || "savePrediction") !== "savePrediction") return jsonResponse_({ ok: false, error: "unsupported_action" });
    return jsonResponse_(savePrediction_(body));
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: "server_error", message: String(error.message || error) });
  }
}

/** Devuelve los partidos solicitados por etapa y semana. */
function getGames_(parameters) {
  return readTable_(APP.sheets.games).records.filter(function (game) {
    const seasonMatches = !parameters.season || Number(game.season) === Number(parameters.season);
    const typeMatches = !parameters.seasonType || String(game.season_type) === String(parameters.seasonType);
    const weekMatches = !parameters.week || Number(game.week) === Number(parameters.week);
    return seasonMatches && typeMatches && weekMatches;
  });
}

/**
 * Devuelve pronósticos, ocultando la selección mientras el partido no haya
 * comenzado. Así ningún participante puede consultar anticipadamente picks ajenos.
 */
function getPredictions_(parameters) {
  const games = readTable_(APP.sheets.games).records;
  const gamesById = games.reduce(function (map, game) { map[String(game.game_id)] = game; return map; }, {});
  return readTable_(APP.sheets.predictions).records
    .filter(function (prediction) {
      const game = gamesById[String(prediction.game_id)];
      if (!game) return false;
      const typeMatches = !parameters.seasonType || String(game.season_type) === String(parameters.seasonType);
      const weekMatches = !parameters.week || Number(game.week) === Number(parameters.week);
      const participantMatches = !parameters.participant || normalizeParticipantName_(prediction.participant_name_display) === normalizeParticipantName_(parameters.participant);
      return typeMatches && weekMatches && participantMatches;
    })
    .map(function (prediction) {
      const game = gamesById[String(prediction.game_id)];
      const revealed = Date.now() >= new Date(game.kickoff_utc).getTime();
      if (revealed) return prediction;
      prediction.predicted_winner_team_id = "";
      prediction.is_safe_pick = "";
      prediction.is_upset_pick = "";
      prediction.pick_hidden = true;
      return prediction;
    });
}

/** Valida y guarda atómicamente un pronóstico. */
function savePrediction_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const participantDisplay = String(body.participantName || "").trim().replace(/\s+/g, " ");
    const participantKey = normalizeParticipantName_(participantDisplay);
    const gameId = String(body.gameId || "");
    const teamId = String(body.teamId || "");
    const safe = body.safe === true;
    const upset = body.upset === true;
    if (participantDisplay.length < 3 || !participantKey || !gameId || !teamId) return { ok: false, error: "missing_fields" };
    if (safe && upset) return { ok: false, error: "pick_cannot_be_safe_and_upset" };

    const gamesTable = readTable_(APP.sheets.games);
    const gamesById = gamesTable.records.reduce(function (map, game) { map[String(game.game_id)] = game; return map; }, {});
    const game = gamesById[gameId];
    if (!game) return { ok: false, error: "game_not_found" };
    if ([String(game.away_team_id), String(game.home_team_id)].indexOf(teamId) === -1) return { ok: false, error: "team_not_in_game" };
    if (Date.now() >= new Date(game.kickoff_utc).getTime()) return { ok: false, error: "game_locked" };

    const predictionsTable = readTable_(APP.sheets.predictions);
    const existing = predictionsTable.records.filter(function (prediction) { return normalizeParticipantName_(prediction.participant_name_display) === participantKey; });
    if (existing.some(function (prediction) { return String(prediction.game_id) === gameId; })) return { ok: false, error: "duplicate_prediction" };

    const sameStageAndWeek = existing.filter(function (prediction) {
      const predictionGame = gamesById[String(prediction.game_id)];
      return predictionGame && String(predictionGame.season_type) === String(game.season_type) && Number(predictionGame.week) === Number(game.week);
    });
    if (safe && sameStageAndWeek.some(function (prediction) { return prediction.is_safe_pick === true; })) return { ok: false, error: "safe_pick_limit" };
    if (upset && sameStageAndWeek.some(function (prediction) { return prediction.is_upset_pick === true; })) return { ok: false, error: "upset_pick_limit" };

    const now = new Date();
    const valuesByHeader = {
      prediction_id: Utilities.getUuid(), season: APP.season, week: Number(game.week), game_id: gameId,
      participant_name_display: participantDisplay, participant_name_key: participantKey,
      predicted_winner_team_id: teamId, is_safe_pick: safe, is_upset_pick: upset,
      submitted_at_utc: now, submitted_timezone: body.timezone || "UTC", prediction_result: "pending",
      is_correct: "", source: "web", created_at: now, updated_at: now,
    };
    const newRow = predictionsTable.headers.map(function (header) { return Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : ""; });
    predictionsTable.sheet.appendRow(newRow);
    return { ok: true, predictionId: valuesByHeader.prediction_id };
  } finally {
    lock.releaseLock();
  }
}

/** Prueba local que no escribe datos y deja el resultado en el registro. */
function testBackend() {
  const result = { ok: true, games: readTable_(APP.sheets.games).records.length, predictions: readTable_(APP.sheets.predictions).records.length };
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Punto reservado para la sincronización programada. Se activará cuando
 * conectemos la fuente deportiva y configuremos los disparadores horarios.
 */
function syncSchedule2026() {
  SpreadsheetApp.getUi().alert("La sincronización automática se configurará en la siguiente etapa.");
}
