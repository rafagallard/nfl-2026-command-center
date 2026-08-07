/**
 * Automatización operativa para calendario, marcadores y pronósticos.
 * El disparador se ejecuta cada hora, pero esta función decide si corresponde
 * sincronizar según el día y la hora en America/Mexico_City.
 */

/** Instala un único disparador horario y evita duplicados. */
function installAutomationTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "scheduledSync2026") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("scheduledSync2026").timeBased().everyHours(1).create();
  console.log("Disparador horario instalado correctamente.");
}

/** Determina las horas de actualización intensiva y de mantenimiento. */
function shouldRunSync_(now) {
  const timezone = "America/Mexico_City";
  const weekday = Number(Utilities.formatDate(now, timezone, "u")); // 1=lunes, 7=domingo.
  const hour = Number(Utilities.formatDate(now, timezone, "H"));
  const gameDay = [1, 4, 5, 6, 7].indexOf(weekday) !== -1;
  if (gameDay) return hour <= 1 || (hour >= 10 && hour <= 23);
  return [6, 12, 18].indexOf(hour) !== -1;
}

/** Ejecuta la sincronización programada sin permitir procesos simultáneos. */
function scheduledSync2026() {
  const now = new Date();
  if (!shouldRunSync_(now)) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  const startedAt = new Date();
  try {
    const stepErrors = [];
    let scheduleResult = { gamesRead: 0, gamesUpdated: 0, errors: [] };
    let playResult = { playsImported: 0, errors: [] };
    let result = { updated: 0 };
    try { scheduleResult = syncRecentGameStatuses2026(); } catch (error) { stepErrors.push("marcadores: " + String(error.message || error)); }
    try { playResult = syncRecentPlayByPlay2026(); } catch (error) { stepErrors.push("jugadas: " + String(error.message || error)); }
    try { result = updatePredictionResults_(); } catch (error) { stepErrors.push("pronósticos: " + String(error.message || error)); }
    Array.prototype.push.apply(stepErrors, scheduleResult.errors || []);
    Array.prototype.push.apply(stepErrors, playResult.errors || []);
    writeSyncLog_({
      startedAt: startedAt, finishedAt: new Date(), status: stepErrors.length ? "partial" : "success",
      recordsRead: scheduleResult.gamesRead,
      recordsInserted: playResult.playsImported, recordsUpdated: result.updated,
      errors: stepErrors.length,
      message: stepErrors.length ? "Sincronización parcial: " + stepErrors.join(" | ") : "Marcadores, jugadas y pronósticos actualizados.",
    });
  } catch (error) {
    console.error(error);
    writeSyncLog_({
      startedAt: startedAt, finishedAt: new Date(), status: "error",
      recordsRead: 0, recordsInserted: 0, recordsUpdated: 0,
      errors: 1, message: String(error.message || error),
    });
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/** Compara picks pendientes con partidos finalizados y registra aciertos. */
function updatePredictionResults_() {
  const games = readTable_(APP.sheets.games).records;
  const gamesById = games.reduce(function (map, game) { map[String(game.game_id)] = game; return map; }, {});
  const table = readTable_(APP.sheets.predictions);
  let updated = 0;
  const resultIndex = table.headers.indexOf("prediction_result");
  const correctIndex = table.headers.indexOf("is_correct");
  const updatedAtIndex = table.headers.indexOf("updated_at");

  table.rows.forEach(function (row) {
    const gameId = String(row[table.headers.indexOf("game_id")]);
    const predictedTeam = String(row[table.headers.indexOf("predicted_winner_team_id")]);
    const game = gamesById[gameId];
    if (!game || game.status !== "final" || !game.winner_team_id) return;
    const isCorrect = predictedTeam === String(game.winner_team_id);
    const newResult = isCorrect ? "correct" : "incorrect";
    if (row[resultIndex] === newResult && row[correctIndex] === isCorrect) return;
    row[resultIndex] = newResult;
    row[correctIndex] = isCorrect;
    row[updatedAtIndex] = new Date();
    updated += 1;
  });

  if (table.rows.length) table.sheet.getRange(2, 1, table.rows.length, table.headers.length).setValues(table.rows);
  return { updated: updated };
}

/** Escribe una ejecución en Sync_Log siguiendo sus encabezados actuales. */
function writeSyncLog_(result) {
  const table = readTable_("Sync_Log");
  const values = {
    sync_id: Utilities.getUuid(), source: "espn", entity: "games_predictions",
    started_at: result.startedAt, finished_at: result.finishedAt, status: result.status,
    records_read: result.recordsRead, records_inserted: result.recordsInserted,
    records_updated: result.recordsUpdated, errors: result.errors, message: result.message,
  };
  table.sheet.appendRow(table.headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(values, header) ? values[header] : "";
  }));
}

/** Prueba manual completa que sincroniza, califica y registra el resultado. */
function testScheduledSync2026() {
  const startedAt = new Date();
  const scheduleResult = syncRecentGameStatuses2026();
  const playResult = syncRecentPlayByPlay2026();
  const result = updatePredictionResults_();
  writeSyncLog_({
    startedAt: startedAt, finishedAt: new Date(), status: "success",
    recordsRead: scheduleResult.gamesRead,
    recordsInserted: playResult.playsImported, recordsUpdated: result.updated, errors: 0,
    message: "Prueba manual completada correctamente.",
  });
  console.log(JSON.stringify({ ok: true, playsImported: playResult.playsImported, predictionsUpdated: result.updated }, null, 2));
}
