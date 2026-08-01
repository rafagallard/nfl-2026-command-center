/**
 * Receives prediction submissions from the web application and writes them safely to Google Sheets.
 * Deploy this file as a Google Apps Script web app after assigning the spreadsheet ID.
 */
const SPREADSHEET_ID = "145d64hKoIZFIUobAFD-RxmS_F_DB5eO298Tq0YGbKbs";

/** Normalizes a participant name so case, accents, and repeated spaces cannot bypass duplicate checks. */
function normalizeParticipantName_(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Returns a JSON response with a consistent contract for the frontend. */
function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

/** Handles read requests used by the history and standings screens. */
function doGet(event) {
  const action = event.parameter.action || "health";
  if (action === "health") return jsonResponse_({ ok: true, service: "nfl-2026-predictions" });
  return jsonResponse_({ ok: false, error: "unsupported_action" });
}

/**
 * Validates and stores one prediction. LockService prevents simultaneous duplicate writes.
 */
function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(event.postData.contents || "{}");
    const participantDisplay = String(body.participantName || "").trim().replace(/\s+/g, " ");
    const participantKey = normalizeParticipantName_(participantDisplay);
    if (!participantKey || !body.gameId || !body.teamId) return jsonResponse_({ ok: false, error: "missing_fields" });

    const workbook = SpreadsheetApp.openById(SPREADSHEET_ID);
    const gamesSheet = workbook.getSheetByName("Games");
    const predictionsSheet = workbook.getSheetByName("Predictions");
    const games = gamesSheet.getDataRange().getValues();
    const headers = games.shift();
    const gameIdIndex = headers.indexOf("game_id");
    const kickoffIndex = headers.indexOf("kickoff_utc");
    const game = games.find((row) => String(row[gameIdIndex]) === String(body.gameId));
    if (!game) return jsonResponse_({ ok: false, error: "game_not_found" });
    if (Date.now() >= new Date(game[kickoffIndex]).getTime()) return jsonResponse_({ ok: false, error: "game_locked" });

    const rows = predictionsSheet.getDataRange().getValues();
    const predictionHeaders = rows.shift();
    const participantIndex = predictionHeaders.indexOf("participant_name_key");
    const predictionGameIndex = predictionHeaders.indexOf("game_id");
    const duplicate = rows.some((row) => String(row[predictionGameIndex]) === String(body.gameId) && String(row[participantIndex]) === participantKey);
    if (duplicate) return jsonResponse_({ ok: false, error: "duplicate_prediction" });

    const record = predictionHeaders.map((header) => ({
      prediction_id: Utilities.getUuid(), season: 2026, week: Number(body.week || 1), game_id: body.gameId,
      participant_name_display: participantDisplay, participant_name_key: participantKey,
      predicted_winner_team_id: body.teamId, is_safe_pick: Boolean(body.safe), is_upset_pick: Boolean(body.upset),
      submitted_at_utc: new Date(), submitted_timezone: body.timezone || "UTC", prediction_result: "pending",
      is_correct: "", source: "web", created_at: new Date(), updated_at: new Date(),
    }[header] ?? ""));
    predictionsSheet.appendRow(record);
    return jsonResponse_({ ok: true, predictionId: record[0] });
  } finally {
    lock.releaseLock();
  }
}
