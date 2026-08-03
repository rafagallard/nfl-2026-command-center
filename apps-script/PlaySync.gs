/**
 * Importa play-by-play de partidos iniciados y genera explicaciones bilingües.
 * Sólo consulta partidos recientes; las jugadas históricas ya guardadas se conservan.
 */

/** Clasifica una jugada en una categoría estable para filtros y explicaciones. */
function classifyPlay_(typeText, description) {
  const text = (String(typeText || "") + " " + String(description || "")).toLowerCase();
  if (/intercept/.test(text)) return "interception";
  if (/fumble/.test(text)) return "fumble";
  if (/sack/.test(text)) return "sack";
  if (/field goal/.test(text)) return "field_goal";
  if (/extra point|pat /.test(text)) return "extra_point";
  if (/two-point|2-point/.test(text)) return "two_point";
  if (/punt/.test(text)) return "punt";
  if (/kickoff/.test(text)) return "kickoff";
  if (/penalty/.test(text)) return "penalty";
  if (/timeout/.test(text)) return "timeout";
  if (/kneel/.test(text)) return "kneel";
  if (/spike/.test(text)) return "spike";
  if (/pass/.test(text)) return "pass";
  if (/rush|run |scramble/.test(text)) return "run";
  return "other";
}

/** Define el concepto y explica la finalidad habitual del tipo de jugada. */
function getPlayExplanation_(playType) {
  const explanations = {
    pass: ["Pass play", "Jugada de pase", "The quarterback throws toward an eligible receiver to advance the ball through the air.", "El quarterback lanza hacia un receptor elegible para avanzar el balón por aire."],
    run: ["Running play", "Jugada de carrera", "The offense advances the ball on the ground through a handoff, keeper, or scramble.", "La ofensiva avanza por tierra mediante una entrega, carrera del quarterback o escape."],
    sack: ["Quarterback sack", "Captura del quarterback", "The defense tackles the quarterback behind the line before a pass is completed.", "La defensa derriba al quarterback detrás de la línea antes de que complete un pase."],
    interception: ["Interception", "Intercepción", "A defender catches a forward pass and possession changes to the defense.", "Un defensivo atrapa un pase hacia adelante y la posesión cambia de equipo."],
    fumble: ["Fumble", "Balón suelto", "The ball carrier loses control before being down; possession may change after recovery.", "El portador pierde el control antes de ser derribado; la posesión puede cambiar tras la recuperación."],
    punt: ["Punt", "Despeje", "On fourth down, the offense kicks the ball away to improve field position.", "Normalmente en cuarta oportunidad, la ofensiva despeja para mejorar la posición de campo."],
    field_goal: ["Field-goal attempt", "Intento de gol de campo", "The kicker attempts to send the ball through the uprights for three points.", "El pateador intenta pasar el balón entre los postes para conseguir tres puntos."],
    extra_point: ["Extra-point attempt", "Intento de punto extra", "After a touchdown, the kicker attempts a one-point conversion.", "Después de un touchdown, el pateador intenta una conversión de un punto."],
    two_point: ["Two-point conversion", "Conversión de dos puntos", "After a touchdown, the offense runs one play from short range for two points.", "Después de un touchdown, la ofensiva ejecuta una jugada corta para obtener dos puntos."],
    kickoff: ["Kickoff", "Patada de salida", "A free kick starts a half or restarts play after a score.", "Una patada libre inicia una mitad o reanuda el juego después de una anotación."],
    penalty: ["Penalty", "Castigo", "Officials detected an infraction; the result depends on enforcement and whether it was accepted.", "Los oficiales detectaron una infracción; el resultado depende de la aplicación y aceptación del castigo."],
    timeout: ["Timeout", "Tiempo fuera", "The game clock is stopped by a team or official for administration or strategy.", "El reloj se detiene por solicitud de un equipo o de los oficiales, por estrategia o administración."],
    kneel: ["Quarterback kneel", "Rodilla del quarterback", "The quarterback intentionally kneels to keep possession while allowing the clock to run.", "El quarterback se arrodilla para conservar la posesión y consumir tiempo."],
    spike: ["Clock-stopping spike", "Pase clavado para detener el reloj", "The quarterback immediately throws the ball into the ground to stop the clock.", "El quarterback lanza inmediatamente el balón al suelo para detener el reloj."],
    other: ["Administrative play", "Jugada administrativa", "A recorded game event that does not fit a standard offensive or kicking category.", "Evento registrado que no corresponde a una categoría ofensiva o de patada estándar."],
  };
  return explanations[playType] || explanations.other;
}

/** Garantiza capacidad suficiente antes de escribir tablas que crecerán por partido. */
function ensureSheetRows_(sheet, requiredRows) {
  if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
}

/** Descarga y transforma todas las jugadas disponibles para un partido. */
function fetchGamePlays_(game) {
  const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=" + game.game_id;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error("No fue posible descargar jugadas del partido " + game.game_id);
  const payload = JSON.parse(response.getContentText());
  const drives = ((payload.drives && payload.drives.previous) || []).slice();
  if (payload.drives && payload.drives.current) drives.push(payload.drives.current);
  const plays = [];
  const tags = [];
  drives.forEach(function (drive) {
    (drive.plays || []).forEach(function (play, index) {
      const playId = String(play.id || (game.game_id + "-" + drive.id + "-" + index));
      const description = play.text || play.shortText || "";
      const playType = classifyPlay_(play.type && play.type.text, description);
      const explanation = getPlayExplanation_(playType);
      const teamAbbreviation = (play.team && play.team.abbreviation) || (drive.team && drive.team.abbreviation) || "";
      const start = play.start || {};
      plays.push({
        play_id: playId, game_id: String(game.game_id), sequence: Number(play.sequenceNumber || plays.length + 1),
        quarter: Number((play.period && play.period.number) || 0), clock: (play.clock && play.clock.displayValue) || "",
        possession_team_id: normalizeTeamId_(teamAbbreviation), down: Number(start.down || 0),
        distance: Number(start.distance || 0), yard_line: start.yardLine || start.yardsToEndzone || "",
        play_type: playType, description_en: description, description_es: explanation[3],
        yards_gained: Number(play.statYardage || 0), scoring_play: play.scoringPlay === true,
        turnover: /intercept|fumble/.test((String(play.type && play.type.text) + " " + description).toLowerCase()), source_url: url,
      });
      tags.push({
        play_id: playId, offensive_personnel: "", formation: "", concept_en: explanation[0], concept_es: explanation[1],
        defensive_look: "", confidence: "rule-based", explanation_en: explanation[2], explanation_es: explanation[3],
        review_status: "automatic", updated_at: new Date(),
      });
    });
  });
  return { plays: plays, tags: tags };
}

/** Sincroniza partidos iniciados durante los últimos siete días. */
function syncRecentPlayByPlay2026() {
  const now = Date.now();
  const recentGames = readTable_(APP.sheets.games).records.filter(function (game) {
    const kickoff = new Date(game.kickoff_utc).getTime();
    return kickoff <= now && kickoff >= now - 7 * 86400000 && ["live", "final"].indexOf(String(game.status)) !== -1;
  });
  if (!recentGames.length) {
    console.log(JSON.stringify({ ok: true, gamesRead: 0, playsImported: 0, message: "No hay partidos iniciados en los últimos siete días." }, null, 2));
    return { gamesRead: 0, playsImported: 0 };
  }

  const affectedIds = recentGames.reduce(function (set, game) { set[String(game.game_id)] = true; return set; }, {});
  const playTable = readTable_("Play_By_Play");
  const tagTable = readTable_("Play_Tags");
  const plays = playTable.records.filter(function (play) { return !affectedIds[String(play.game_id)]; });
  const retainedPlayIds = plays.reduce(function (set, play) { set[String(play.play_id)] = true; return set; }, {});
  const tags = tagTable.records.filter(function (tag) { return retainedPlayIds[String(tag.play_id)]; });
  recentGames.forEach(function (game) {
    const imported = fetchGamePlays_(game);
    Array.prototype.push.apply(plays, imported.plays);
    Array.prototype.push.apply(tags, imported.tags);
  });

  const playRows = plays.map(function (record) { return playTable.headers.map(function (header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ""; }); });
  const tagRows = tags.map(function (record) { return tagTable.headers.map(function (header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ""; }); });
  ensureSheetRows_(playTable.sheet, playRows.length + 1); ensureSheetRows_(tagTable.sheet, tagRows.length + 1);
  if (playTable.sheet.getLastRow() > 1) playTable.sheet.getRange(2, 1, playTable.sheet.getLastRow() - 1, playTable.headers.length).clearContent();
  if (tagTable.sheet.getLastRow() > 1) tagTable.sheet.getRange(2, 1, tagTable.sheet.getLastRow() - 1, tagTable.headers.length).clearContent();
  if (playRows.length) playTable.sheet.getRange(2, 1, playRows.length, playTable.headers.length).setValues(playRows);
  if (tagRows.length) tagTable.sheet.getRange(2, 1, tagRows.length, tagTable.headers.length).setValues(tagRows);
  console.log(JSON.stringify({ ok: true, gamesRead: recentGames.length, playsImported: playRows.length }, null, 2));
  return { gamesRead: recentGames.length, playsImported: playRows.length };
}
