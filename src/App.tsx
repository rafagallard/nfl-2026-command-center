import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, CalendarDays, Languages, LayoutDashboard, Shield, Target, Trophy, Users } from "lucide-react";
import { fallbackGames, findTeam, Game, hallOfFameGame, positionGroups, scheduleSlots, ScheduleSlot, teams } from "./data";

type Language = "es" | "en";
type View = "home" | "standings" | "predictions" | "dashboard" | "clusters" | "plays" | "positions";

interface Prediction {
  id: string;
  gameId: string;
  week: number;
  participantDisplay: string;
  participantKey: string;
  teamId: string;
  safe: boolean;
  upset: boolean;
  submittedAt: string;
  pickHidden?: boolean;
  result?: "pending" | "correct" | "incorrect";
  isCorrect?: boolean;
}

interface PlayRecord {
  playId: string;
  gameId: string;
  sequence: number;
  quarter: number;
  clock: string;
  teamId: string;
  down: number;
  distance: number;
  yardLine: string | number;
  playType: string;
  descriptionEn: string;
  descriptionEs: string;
  yards: number;
  scoring: boolean;
  turnover: boolean;
  conceptEn: string;
  conceptEs: string;
  explanationEn: string;
  explanationEs: string;
}

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxY8aPfp3QaTx21dQtSdqQx-GX6CUNRKjRV1lsA75NPy5hdsqU6oG41mLKbQIVfm01pTw/exec";

const copy = {
  es: {
    season: "TEMPORADA 2026", home: "Inicio", standings: "Clasificaciones", predictions: "Pronósticos", dashboard: "Dashboard", clusters: "Carrera a playoffs", plays: "Sala de Jugadas", positions: "Posiciones",
    title: "NFL 2026 — Semana 1", subtitle: "Calendario, avance y pronósticos de ganador", nextGames: "Próximos partidos", register: "Registrar pronóstico", participant: "Nombre completo", choose: "Elige al ganador", safe: "Selección segura", upset: "Sorpresa de la semana", save: "Guardar pronóstico", history: "Historial", empty: "Todavía no hay pronósticos registrados.", duplicate: "Ya existe un pronóstico para este partido registrado con ese nombre.", saved: "Pronóstico registrado correctamente.", kickoff: "Inicio", final: "Final", scheduled: "Programado", localTime: "Hora local", accuracy: "Efectividad", records: "Registros", correct: "Aciertos", popular: "Equipo más seleccionado", source: "Datos reales 2026 · Actualización automática en preparación", all: "Todos", afc: "AFC", nfc: "NFC", team: "Equipo", conference: "Conferencia", division: "División", record: "Récord", streak: "Racha", filmTitle: "Sala de Jugadas", filmEmpty: "El análisis play-by-play se habilitará después del primer partido de 2026.", anatomy: "Radiografía de posiciones", englishName: "Nombre en inglés", spanishName: "Nombre en español", function: "Función principal", noScore: "Se elige únicamente al ganador; no se pronostican marcadores.", filterMember: "Filtrar por participante", filterGame: "Filtrar por partido", status: "Estado",
  },
  en: {
    season: "2026 SEASON", home: "Home", standings: "Standings", predictions: "Predictions", dashboard: "Dashboard", clusters: "Playoff Race", plays: "Film Room", positions: "Positions",
    title: "NFL 2026 — Week 1", subtitle: "Schedule, progress and winner predictions", nextGames: "Upcoming games", register: "Submit a prediction", participant: "Full name", choose: "Pick the winner", safe: "Safe pick", upset: "Upset of the week", save: "Save prediction", history: "History", empty: "No predictions have been submitted yet.", duplicate: "A prediction for this game already exists under that name.", saved: "Prediction submitted successfully.", kickoff: "Kickoff", final: "Final", scheduled: "Scheduled", localTime: "Local time", accuracy: "Accuracy", records: "Entries", correct: "Correct", popular: "Most selected team", source: "Real 2026 data · Automatic updates being prepared", all: "All", afc: "AFC", nfc: "NFC", team: "Team", conference: "Conference", division: "Division", record: "Record", streak: "Streak", filmTitle: "Film Room", filmEmpty: "Play-by-play analysis will be enabled after the first 2026 game.", anatomy: "Position anatomy", englishName: "English name", spanishName: "Spanish name", function: "Primary role", noScore: "Pick the winner only; score predictions are not required.", filterMember: "Filter by participant", filterGame: "Filter by game", status: "Status",
  },
};

const navItems: Array<{ id: View; icon: typeof Trophy }> = [
  { id: "home", icon: CalendarDays }, { id: "standings", icon: Trophy }, { id: "predictions", icon: Target }, { id: "dashboard", icon: LayoutDashboard }, { id: "clusters", icon: BarChart3 }, { id: "plays", icon: BookOpen }, { id: "positions", icon: Users },
];

// Normalization makes duplicate validation insensitive to case, accents, and repeated spaces.
function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");
}

function loadPredictions(): Prediction[] {
  try { return JSON.parse(localStorage.getItem("nfl-2026-predictions") || "[]"); } catch { return []; }
}

// The ESPN adapter keeps data-source details outside presentation components.
async function loadWeekGames(slot: ScheduleSlot): Promise<Game[]> {
  const fallback = slot.id === "hof" ? hallOfFameGame : slot.id === "reg-1" ? fallbackGames : [];
  try {
    const backendResponse = await fetch(`${BACKEND_URL}?action=games&season=2026&seasonType=${encodeURIComponent(slot.phase)}&week=${slot.displayWeek}`);
    if (backendResponse.ok) {
      const backendPayload = await backendResponse.json();
      const backendGames = (backendPayload.games || []).map((game: any): Game => ({
        id: String(game.game_id), week: Number(game.week), kickoffUtc: game.kickoff_utc,
        away: game.away_team_id, home: game.home_team_id, venue: game.venue || "TBD",
        status: game.status || "scheduled", awayScore: Number(game.away_score || 0), homeScore: Number(game.home_score || 0),
      }));
      if (backendGames.length) return backendGames;
    }
  } catch { /* ESPN remains available as a read-only fallback. */ }

  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=${slot.seasonType}&week=${slot.espnWeek}&dates=2026`);
    if (!response.ok) return fallback;
    const payload = await response.json();
    const mapped = (payload.events || []).map((event: any): Game | null => {
      const competition = event.competitions?.[0];
      const home = competition?.competitors?.find((item: any) => item.homeAway === "home");
      const away = competition?.competitors?.find((item: any) => item.homeAway === "away");
      const homeTeam = teams.find((team) => team.abbr === home?.team?.abbreviation);
      const awayTeam = teams.find((team) => team.abbr === away?.team?.abbreviation);
      if (!homeTeam || !awayTeam) return null;
      const state = event.status?.type?.state;
      return { id: String(event.id), week: slot.displayWeek, kickoffUtc: event.date, away: awayTeam.id, home: homeTeam.id, venue: competition?.venue?.fullName || "TBD", status: state === "post" ? "final" : state === "in" ? "live" : "scheduled", awayScore: Number(away.score || 0), homeScore: Number(home.score || 0) };
    }).filter(Boolean);
    return mapped.length ? mapped : fallback;
  } catch { return slot.id === "hof" ? hallOfFameGame : slot.id === "reg-1" ? fallbackGames : []; }
}

/** Reads the shared prediction history while preserving an offline cache. */
async function loadSharedPredictions(): Promise<Prediction[]> {
  const response = await fetch(`${BACKEND_URL}?action=predictions`);
  if (!response.ok) throw new Error("prediction_history_unavailable");
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "prediction_history_unavailable");
  return (payload.predictions || []).map((prediction: any): Prediction => ({
    id: String(prediction.prediction_id), gameId: String(prediction.game_id), week: Number(prediction.week),
    participantDisplay: prediction.participant_name_display, participantKey: prediction.participant_name_key,
    teamId: prediction.predicted_winner_team_id || "", safe: prediction.is_safe_pick === true,
    upset: prediction.is_upset_pick === true, submittedAt: prediction.submitted_at_utc,
    pickHidden: prediction.pick_hidden === true,
    result: prediction.prediction_result || "pending",
    isCorrect: prediction.is_correct === true,
  }));
}

/** Loads the complete season index used by historical filters. */
async function loadAllGames(): Promise<Game[]> {
  const response = await fetch(`${BACKEND_URL}?action=games&season=2026`);
  if (!response.ok) throw new Error("game_history_unavailable");
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "game_history_unavailable");
  return (payload.games || []).map((game: any): Game => ({
    id: String(game.game_id), week: Number(game.week), kickoffUtc: game.kickoff_utc,
    away: game.away_team_id, home: game.home_team_id, venue: game.venue || "TBD",
    status: game.status || "scheduled", awayScore: Number(game.away_score || 0), homeScore: Number(game.home_score || 0),
  }));
}

/** Loads a team's available play-by-play history from the shared backend. */
async function loadTeamPlays(teamId: string): Promise<PlayRecord[]> {
  const response = await fetch(`${BACKEND_URL}?action=plays&teamId=${encodeURIComponent(teamId)}`);
  if (!response.ok) throw new Error("play_history_unavailable");
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "play_history_unavailable");
  return (payload.plays || []).map((play: any): PlayRecord => ({
    playId: String(play.play_id), gameId: String(play.game_id), sequence: Number(play.sequence),
    quarter: Number(play.quarter), clock: play.clock, teamId: play.possession_team_id,
    down: Number(play.down), distance: Number(play.distance), yardLine: play.yard_line,
    playType: play.play_type, descriptionEn: play.description_en, descriptionEs: play.description_es,
    yards: Number(play.yards_gained), scoring: play.scoring_play === true, turnover: play.turnover === true,
    conceptEn: play.tags?.concept_en || play.play_type, conceptEs: play.tags?.concept_es || play.play_type,
    explanationEn: play.tags?.explanation_en || "", explanationEs: play.tags?.explanation_es || "",
  }));
}

// Chooses the most relevant schedule view when the application opens.
function getInitialScheduleSlotId() {
  const now = Date.now();
  const boundary = (iso: string) => Date.parse(iso);
  if (now < boundary("2026-08-10T00:00:00Z")) return "hof";
  if (now < boundary("2026-08-17T00:00:00Z")) return "pre-1";
  if (now < boundary("2026-08-24T00:00:00Z")) return "pre-2";
  if (now < boundary("2026-08-31T00:00:00Z")) return "pre-3";
  if (now < boundary("2027-01-12T00:00:00Z")) {
    const regularWeek = Math.min(18, Math.max(1, Math.floor((now - boundary("2026-09-09T00:00:00Z")) / 604800000) + 1));
    return `reg-${regularWeek}`;
  }
  if (now < boundary("2027-01-19T00:00:00Z")) return "post-1";
  if (now < boundary("2027-01-26T00:00:00Z")) return "post-2";
  if (now < boundary("2027-02-08T00:00:00Z")) return "post-3";
  return "post-5";
}

interface TeamSeasonStats {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  played: number;
  pct: number;
  diff: number;
}

/** Derives the public season stage from the scheduled kickoff. */
function phaseForGame(game?: Game) {
  if (!game) return "";
  if (game.week === 0) return "hall-of-fame";
  if (game.kickoffUtc < "2026-09-01") return "preseason";
  if (game.kickoffUtc < "2027-01-12") return "regular";
  return "postseason";
}

/** Calculates one record per team from final games in the requested stage. */
function calculateTeamSeasonStats(games: Game[], phase: "preseason" | "regular") {
  const stats = teams.reduce<Record<string, TeamSeasonStats>>((acc, team) => {
    acc[team.id] = { teamId: team.id, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, played: 0, pct: 0, diff: 0 };
    return acc;
  }, {});
  games.filter((game) => game.status === "final" && game.away !== "tbd" && game.home !== "tbd" && (phase === "preseason" ? ["hall-of-fame", "preseason"].includes(phaseForGame(game)) : phaseForGame(game) === "regular")).forEach((game) => {
    const away = stats[game.away]; const home = stats[game.home];
    if (!away || !home) return;
    const awayScore = Number(game.awayScore || 0); const homeScore = Number(game.homeScore || 0);
    away.played += 1; home.played += 1; away.pf += awayScore; away.pa += homeScore; home.pf += homeScore; home.pa += awayScore;
    if (awayScore === homeScore) { away.ties += 1; home.ties += 1; }
    else if (awayScore > homeScore) { away.wins += 1; home.losses += 1; }
    else { home.wins += 1; away.losses += 1; }
  });
  Object.values(stats).forEach((value) => { value.pct = value.played ? (value.wins + value.ties * .5) / value.played : 0; value.diff = value.pf - value.pa; });
  return stats;
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("nfl-language") as Language) || "es");
  const [view, setView] = useState<View>("home");
  const [selectedSlotId, setSelectedSlotId] = useState(getInitialScheduleSlotId);
  const [games, setGames] = useState<Game[]>(hallOfFameGame);
  const [allGames, setAllGames] = useState<Game[]>(hallOfFameGame);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>(loadPredictions);
  const [message, setMessage] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [weekFilter, setWeekFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [standingsPhase, setStandingsPhase] = useState<"preseason" | "regular">("preseason");
  const [filmTeam, setFilmTeam] = useState("car");
  const [filmQuarter, setFilmQuarter] = useState("");
  const [filmType, setFilmType] = useState("");
  const [filmPlays, setFilmPlays] = useState<PlayRecord[]>([]);
  const [filmLoading, setFilmLoading] = useState(false);
  const t = copy[language];

  const selectedSlot = scheduleSlots.find((slot) => slot.id === selectedSlotId) || scheduleSlots[0];

  useEffect(() => {
    let active = true;
    setScheduleLoading(true);
    loadWeekGames(selectedSlot).then((loadedGames) => { if (active) { setGames(loadedGames); setScheduleLoading(false); } });
    return () => { active = false; };
  }, [selectedSlotId]);
  useEffect(() => { localStorage.setItem("nfl-language", language); document.documentElement.lang = language; }, [language]);
  useEffect(() => { localStorage.setItem("nfl-2026-predictions", JSON.stringify(predictions)); }, [predictions]);
  useEffect(() => { loadSharedPredictions().then(setPredictions).catch(() => undefined); }, []);
  useEffect(() => { loadAllGames().then(setAllGames).catch(() => undefined); }, []);
  useEffect(() => { setFilmLoading(true); loadTeamPlays(filmTeam).then(setFilmPlays).catch(() => setFilmPlays([])).finally(() => setFilmLoading(false)); }, [filmTeam]);

  const participantDirectory = useMemo(() => Array.from(predictions.reduce<Map<string, string>>((map, prediction) => {
    if (!map.has(prediction.participantKey)) map.set(prediction.participantKey, prediction.participantDisplay);
    return map;
  }, new Map()).entries()).map(([key, name]) => ({ key, name })).sort((left, right) => left.name.localeCompare(right.name)), [predictions]);
  const participants = participantDirectory.map((participant) => participant.name);
  const gamePhase = phaseForGame;
  const filteredGameOptions = allGames.filter((game) => (!phaseFilter || gamePhase(game) === phaseFilter) && (!weekFilter || game.week === Number(weekFilter)) && game.away !== "tbd" && game.home !== "tbd");
  const visibleHistory = predictions.filter((prediction) => {
    const game = allGames.find((item) => item.id === prediction.gameId);
    return (!memberFilter || prediction.participantKey === memberFilter)
      && (!phaseFilter || gamePhase(game) === phaseFilter)
      && (!weekFilter || game?.week === Number(weekFilter))
      && (!gameFilter || prediction.gameId === gameFilter)
      && (!teamFilter || prediction.teamId === teamFilter)
      && (!resultFilter || prediction.result === resultFilter);
  });

  // This submit path mirrors the future server validation and gives immediate offline behavior.
  async function submitPrediction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const participantDisplay = String(form.get("participant") || "").trim().replace(/\s+/g, " ");
    const participantKey = normalizeName(participantDisplay);
    const gameId = String(form.get("gameId") || "");
    const teamId = String(form.get("teamId") || "");
    const game = games.find((item) => item.id === gameId);
    if (!participantKey || !game || !teamId || ![game.away, game.home].includes(teamId) || Date.now() >= Date.parse(game.kickoffUtc)) return;
    if (predictions.some((item) => item.gameId === gameId && item.participantKey === participantKey)) { setMessage(t.duplicate); return; }
    const safe = form.get("safe") === "on";
    const upset = form.get("upset") === "on";
    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "savePrediction", participantName: participantDisplay, gameId, teamId, safe, upset, week: game.week, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const result = await response.json();
      if (!result.ok) {
        const errors: Record<string, string> = {
          duplicate_prediction: t.duplicate,
          game_locked: language === "es" ? "El partido ya comenzó; el pronóstico está bloqueado." : "The game has started; predictions are locked.",
          safe_pick_limit: language === "es" ? "Ya registraste una selección segura para esta semana." : "You already submitted a safe pick for this week.",
          upset_pick_limit: language === "es" ? "Ya registraste una sorpresa para esta semana." : "You already submitted an upset pick for this week.",
          pick_cannot_be_safe_and_upset: language === "es" ? "Un mismo pronóstico no puede ser selección segura y sorpresa." : "A prediction cannot be both a safe pick and an upset.",
        };
        setMessage(errors[result.error] || (language === "es" ? "No fue posible guardar el pronóstico." : "The prediction could not be saved."));
        return;
      }
      setPredictions(await loadSharedPredictions());
      setMessage(t.saved);
      event.currentTarget.reset();
      setSelectedGameId("");
    } catch {
      setMessage(language === "es" ? "No pudimos conectar con el servicio. Intenta nuevamente." : "We could not reach the service. Please try again.");
    }
  }

  function formatKickoff(iso: string) {
    return new Intl.DateTimeFormat(language === "es" ? "es-MX" : "en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
  }

  const content = view === "home" ? <Home /> : view === "standings" ? <Standings /> : view === "predictions" ? <Predictions /> : view === "dashboard" ? <Dashboard /> : view === "clusters" ? <Clusters /> : view === "plays" ? <FilmRoom /> : <Positions />;

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setView("home")} aria-label="NFL Tracker home"><span className="brand-mark"><Shield size={20} /></span><span><strong>NFL TRACKER</strong><small>{t.season}</small></span></button>
      <nav className="desktop-nav" aria-label="Primary navigation">{navItems.map(({ id, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={16} />{t[id]}</button>)}</nav>
      <button className="language" onClick={() => setLanguage(language === "es" ? "en" : "es")}><Languages size={17} />{language === "es" ? "EN" : "ES"}</button>
    </header>
    <main>{content}</main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(({ id, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={20} /><span>{t[id]}</span></button>)}</nav>
    <footer>NFL TRACKER 2026 · {t.source} · {language === "es" ? "Uso personal · No afiliado con la NFL" : "Personal use · Not affiliated with the NFL"}</footer>
  </div>;

  function PageHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div className="page-heading"><p className="eyebrow">NFL TRACKER 2026</p><h1>{title}</h1><p>{subtitle}</p></div>; }
  function TeamBadge({ id }: { id: string }) { const team = findTeam(id); return <span className="team-badge" style={{ "--team": team.color } as React.CSSProperties}>{team.abbr}</span>; }
  function GameCard({ game, compact = false }: { game: Game; compact?: boolean }) { const away = findTeam(game.away); const home = findTeam(game.home); return <article className={`game-card ${compact ? "compact" : ""}`}><div className="game-meta"><span>{language === "es" ? selectedSlot.labelEs : selectedSlot.labelEn}</span><span>{formatKickoff(game.kickoffUtc)}</span></div><div className="matchup"><div><TeamBadge id={away.id} /><strong>{away.city}</strong><small>{away.name}</small></div><span className="versus">VS</span><div><TeamBadge id={home.id} /><strong>{home.city}</strong><small>{home.name} · HOME</small></div></div><p className="venue">{game.venue}</p></article>; }

  function Home() {
    const slotLabel = language === "es" ? selectedSlot.labelEs : selectedSlot.labelEn;
    const completedGames = games.filter((game) => game.status === "final").length;
    return <div className="page">
      <PageHeading title={`NFL 2026 — ${slotLabel}`} subtitle={t.subtitle} />
      <section className="schedule-toolbar panel">
        <label>{language === "es" ? "Etapa y semana" : "Stage and week"}
          <select value={selectedSlotId} onChange={(event) => setSelectedSlotId(event.target.value)}>
            {scheduleSlots.map((slot) => <option key={slot.id} value={slot.id}>{language === "es" ? slot.labelEs : slot.labelEn}</option>)}
          </select>
        </label>
        <span>{language === "es" ? "Calendario NFL 2026 completo" : "Complete 2026 NFL schedule"}</span>
      </section>
      <section className="summary-grid"><div><span>{t.nextGames}</span><strong>{games.length}</strong><small>{slotLabel}</small></div><div><span>{t.records}</span><strong>{predictions.length}</strong><small>{participants.length} {language === "es" ? "participantes" : "participants"}</small></div><div><span>{t.localTime}</span><strong>{Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace("_", " ")}</strong><small>{language === "es" ? "Detectada automáticamente" : "Detected automatically"}</small></div><div><span>{language === "es" ? "Partidos jugados" : "Games played"}</span><strong>{completedGames}</strong><small>{slotLabel}</small></div></section>
      <section><div className="section-title"><h2>{t.nextGames}</h2><button onClick={() => setView("predictions")}>{t.register}</button></div>{scheduleLoading ? <div className="empty-state"><CalendarDays size={34} /><p>{language === "es" ? "Cargando calendario…" : "Loading schedule…"}</p></div> : games.length ? <div className="games-grid">{games.map((game) => <GameCard key={game.id} game={game} />)}</div> : <div className="empty-state"><CalendarDays size={34} /><p>{language === "es" ? "Los enfrentamientos de esta etapa todavía no han sido publicados." : "Matchups for this stage have not been published yet."}</p></div>}</section>
    </div>;
  }

  function Standings() {
    const eligibleGames = allGames.filter((game) => game.status === "final" && game.away !== "tbd" && game.home !== "tbd" && (standingsPhase === "preseason" ? ["hall-of-fame", "preseason"].includes(gamePhase(game)) : gamePhase(game) === "regular"));
    const stats = teams.reduce<Record<string, { wins: number; losses: number; ties: number; pf: number; pa: number; results: string[] }>>((acc, team) => {
      acc[team.id] = { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, results: [] };
      return acc;
    }, {});
    [...eligibleGames].sort((left, right) => Date.parse(left.kickoffUtc) - Date.parse(right.kickoffUtc)).forEach((game) => {
      const away = stats[game.away]; const home = stats[game.home];
      if (!away || !home) return;
      const awayScore = Number(game.awayScore || 0); const homeScore = Number(game.homeScore || 0);
      away.pf += awayScore; away.pa += homeScore; home.pf += homeScore; home.pa += awayScore;
      if (awayScore === homeScore) { away.ties += 1; home.ties += 1; away.results.push("T"); home.results.push("T"); }
      else if (awayScore > homeScore) { away.wins += 1; home.losses += 1; away.results.push("W"); home.results.push("L"); }
      else { home.wins += 1; away.losses += 1; home.results.push("W"); away.results.push("L"); }
    });
    const percentage = (teamId: string) => { const value = stats[teamId]; const played = value.wins + value.losses + value.ties; return played ? (value.wins + value.ties * .5) / played : 0; };
    const streak = (teamId: string) => { const results = stats[teamId].results; if (!results.length) return "—"; const last = results[results.length - 1]; let count = 0; for (let index = results.length - 1; index >= 0 && results[index] === last; index -= 1) count += 1; return `${last}${count}`; };
    const sortedDivision = (conference: "AFC" | "NFC", division: "East" | "North" | "South" | "West") => teams.filter((team) => team.conference === conference && team.division === division).sort((left, right) => percentage(right.id) - percentage(left.id) || (stats[right.id].pf - stats[right.id].pa) - (stats[left.id].pf - stats[left.id].pa) || stats[right.id].pf - stats[left.id].pf || left.city.localeCompare(right.city));
    return <div className="page"><PageHeading title={language === "es" ? "CLASIFICACIONES NFL 2026" : "NFL 2026 STANDINGS"} subtitle={language === "es" ? "Récord, puntos, diferencial y racha por división" : "Record, points, differential and streak by division"} /><section className="schedule-toolbar panel"><label>{language === "es" ? "Etapa" : "Stage"}<select value={standingsPhase} onChange={(event) => setStandingsPhase(event.target.value as "preseason" | "regular")}><option value="preseason">{language === "es" ? "Pretemporada" : "Preseason"}</option><option value="regular">{language === "es" ? "Temporada regular" : "Regular season"}</option></select></label><span>{eligibleGames.length} {language === "es" ? "partidos finalizados incluidos" : "final games included"}</span></section><div className="conference-columns">{(["AFC", "NFC"] as const).map((conference) => <section key={conference}><h2 className={`conference ${conference.toLowerCase()}`}>{conference}</h2>{(["East", "North", "South", "West"] as const).map((division) => <div className="division-card" key={division}><div className="division-title"><span>{conference}</span><strong>{division.toUpperCase()}</strong></div><div className="standings-head"><span>{t.team}</span><span>W</span><span>L</span><span>T</span><span>PCT</span><span>PF</span><span>DIFF</span></div>{sortedDivision(conference, division).map((team) => { const value = stats[team.id]; const pct = percentage(team.id); const diff = value.pf - value.pa; return <div className="standings-row" key={team.id}><span><TeamBadge id={team.id} /><b>{team.abbr}</b><em>{team.city}</em></span><span>{value.wins}</span><span>{value.losses}</span><span>{value.ties}</span><span>{pct.toFixed(3).replace(/^0/, "")}</span><span>{value.pf}</span><span className={diff > 0 ? "positive" : diff < 0 ? "negative" : ""}>{diff > 0 ? `+${diff}` : diff}<small>{streak(team.id)}</small></span></div>; })}</div>)}</section>)}</div></div>;
  }

  function Predictions() {
    const selectedGame = games.find((game) => game.id === selectedGameId);
    const eligibleTeams = selectedGame ? [findTeam(selectedGame.away), findTeam(selectedGame.home)] : [];
    return <div className="page"><PageHeading title={language === "es" ? "PRONÓSTICOS" : "PREDICTIONS"} subtitle={t.noScore} /><div className="prediction-layout"><section className="panel"><h2>{t.register}</h2><form className="prediction-form" onSubmit={submitPrediction}><label>{t.participant}<input name="participant" required minLength={3} autoComplete="name" placeholder={language === "es" ? "Escribe tu nombre" : "Enter your name"} /></label><label>{language === "es" ? "Partido" : "Game"}<select name="gameId" required value={selectedGameId} onChange={(event) => { setSelectedGameId(event.target.value); setMessage(""); }}><option value="" disabled>{language === "es" ? "Selecciona un partido" : "Select a game"}</option>{games.map((game) => <option key={game.id} value={game.id}>{findTeam(game.away).abbr} vs {findTeam(game.home).abbr} · {formatKickoff(game.kickoffUtc)}</option>)}</select></label><label>{t.choose}<select key={selectedGameId} name="teamId" required defaultValue="" disabled={!selectedGame}><option value="" disabled>{language === "es" ? "Selecciona un equipo" : "Select a team"}</option>{eligibleTeams.map((team) => <option key={team.id} value={team.id}>{team.city} {team.name}</option>)}</select></label><div className="check-row"><label><input type="checkbox" name="safe" /> {t.safe}</label><label><input type="checkbox" name="upset" /> {t.upset}</label></div><button className="primary" type="submit">{t.save}</button>{message && <p className={message === t.saved ? "form-success" : "form-error"} role="status">{message}</p>}</form></section><section className="panel history-panel"><div className="section-title"><h2>{t.history}</h2><span>{visibleHistory.length}</span></div><div className="filter-grid"><select value={phaseFilter} onChange={(e) => { setPhaseFilter(e.target.value); setWeekFilter(""); setGameFilter(""); }}><option value="">{language === "es" ? "Todas las etapas" : "All stages"}</option><option value="hall-of-fame">Hall of Fame</option><option value="preseason">{language === "es" ? "Pretemporada" : "Preseason"}</option><option value="regular">{language === "es" ? "Temporada regular" : "Regular season"}</option><option value="postseason">Playoffs</option></select><select value={weekFilter} onChange={(e) => { setWeekFilter(e.target.value); setGameFilter(""); }}><option value="">{language === "es" ? "Todas las semanas" : "All weeks"}</option>{[...new Set(allGames.filter((game) => !phaseFilter || gamePhase(game) === phaseFilter).map((game) => game.week))].sort((a, b) => a - b).map((week) => <option key={week} value={week}>{week === 0 ? "Hall of Fame" : `${language === "es" ? "Semana" : "Week"} ${week}`}</option>)}</select><select value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}><option value="">{t.filterGame}: {t.all}</option>{filteredGameOptions.map((game) => <option key={game.id} value={game.id}>{findTeam(game.away).abbr} vs {findTeam(game.home).abbr}</option>)}</select><select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}><option value="">{t.filterMember}: {t.all}</option>{participantDirectory.map((participant) => <option key={participant.key} value={participant.key}>{participant.name}</option>)}</select><select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}><option value="">{language === "es" ? "Todos los equipos" : "All teams"}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.abbr} · {team.city}</option>)}</select><select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}><option value="">{language === "es" ? "Todos los resultados" : "All results"}</option><option value="pending">{language === "es" ? "Pendientes" : "Pending"}</option><option value="correct">{language === "es" ? "Acertados" : "Correct"}</option><option value="incorrect">{language === "es" ? "No acertados" : "Incorrect"}</option></select></div>{visibleHistory.length === 0 ? <div className="empty-state"><Target size={34} /><p>{language === "es" ? "No hay registros que coincidan con los filtros." : "No entries match the selected filters."}</p></div> : <div className="history-list">{visibleHistory.map((prediction) => { const game = allGames.find((item) => item.id === prediction.gameId); const revealed = Boolean(game && prediction.teamId && !prediction.pickHidden && Date.now() >= Date.parse(game.kickoffUtc)); return <article key={prediction.id}><div><strong>{prediction.participantDisplay}</strong><small>{game ? `${findTeam(game.away).abbr} vs ${findTeam(game.home).abbr} · ${formatKickoff(game.kickoffUtc)}` : prediction.gameId}</small></div>{revealed ? <TeamBadge id={prediction.teamId} /> : <span className="team-badge">•••</span>}<span>{prediction.result === "correct" ? `✓ ${t.correct}` : prediction.result === "incorrect" ? (language === "es" ? "✕ No acertado" : "✕ Incorrect") : revealed ? (prediction.safe ? "★ SAFE" : prediction.upset ? "⚡ UPSET" : t.scheduled) : (language === "es" ? "Oculto hasta el kickoff" : "Hidden until kickoff")}</span></article>; })}</div>}</section></div></div>;
  }

  function Dashboard() {
    const revealedPredictions = predictions.filter((item) => item.teamId && !item.pickHidden);
    const settledPredictions = predictions.filter((item) => item.result === "correct" || item.result === "incorrect");
    const correctPredictions = settledPredictions.filter((item) => item.isCorrect);
    const accuracy = settledPredictions.length ? Math.round((correctPredictions.length / settledPredictions.length) * 100) : null;
    const topTeam = Object.entries(revealedPredictions.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.teamId]: (acc[item.teamId] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0];
    const participantStats = participantDirectory.map((participant) => {
      const entries = predictions.filter((item) => item.participantKey === participant.key);
      const settled = entries.filter((item) => item.result === "correct" || item.result === "incorrect");
      const correct = settled.filter((item) => item.isCorrect).length;
      return { name: participant.name, entries: entries.length, settled: settled.length, correct, accuracy: settled.length ? Math.round((correct / settled.length) * 100) : null };
    }).sort((left, right) => right.correct - left.correct || (right.accuracy || 0) - (left.accuracy || 0) || left.name.localeCompare(right.name));
    const gameStats = Object.values(settledPredictions.reduce<Record<string, { gameId: string; entries: number; correct: number }>>((acc, item) => {
      const current = acc[item.gameId] || { gameId: item.gameId, entries: 0, correct: 0 };
      current.entries += 1;
      if (item.isCorrect) current.correct += 1;
      acc[item.gameId] = current;
      return acc;
    }, {})).sort((left, right) => right.correct - left.correct || right.entries - left.entries)[0];
    const safest = settledPredictions.filter((item) => item.safe);
    const upsets = settledPredictions.filter((item) => item.upset);
    const safeAccuracy = safest.length ? Math.round((safest.filter((item) => item.isCorrect).length / safest.length) * 100) : null;
    const upsetAccuracy = upsets.length ? Math.round((upsets.filter((item) => item.isCorrect).length / upsets.length) * 100) : null;
    const topGame = gameStats ? games.find((game) => game.id === gameStats.gameId) : undefined;

    return <div className="page"><PageHeading title="DASHBOARD" subtitle={language === "es" ? "Resultados y participación de la temporada 2026" : "2026 season results and participation"} />
      <section className="summary-grid"><div><span>{language === "es" ? "Participantes" : "Participants"}</span><strong>{participants.length}</strong><small>{predictions.length} {t.records.toLowerCase()}</small></div><div><span>{language === "es" ? "Partidos evaluados" : "Evaluated picks"}</span><strong>{settledPredictions.length}</strong><small>{correctPredictions.length} {t.correct.toLowerCase()}</small></div><div><span>{t.accuracy}</span><strong>{accuracy === null ? "—" : `${accuracy}%`}</strong><small>{accuracy === null ? (language === "es" ? "Disponible al terminar partidos" : "Available after final games") : `${correctPredictions.length}/${settledPredictions.length}`}</small></div><div><span>{t.popular}</span><strong>{topTeam ? findTeam(topTeam[0]).abbr : "—"}</strong><small>{topTeam ? `${topTeam[1]} ${t.records.toLowerCase()}` : (language === "es" ? "Se revelará al kickoff" : "Revealed at kickoff")}</small></div></section>
      <div className="dashboard-grid"><section className="panel"><h2>{language === "es" ? "Tabla de participantes" : "Participant standings"}</h2>{participantStats.length ? <div className="leaderboard detailed">{participantStats.map((participant, index) => <div key={participant.name}><span>{index + 1}</span><strong>{participant.name}<small>{participant.correct} {t.correct.toLowerCase()} · {participant.settled} {language === "es" ? "evaluados" : "graded"}</small></strong><div><i style={{ width: `${participant.accuracy || 0}%` }} /></div><b>{participant.accuracy === null ? "—" : `${participant.accuracy}%`}</b></div>)}</div> : <div className="empty-state"><Users size={34} /><p>{t.empty}</p></div>}</section>
        <section className="panel highlights"><h2>{language === "es" ? "Indicadores especiales" : "Special indicators"}</h2><div><span>★ {t.safe}</span><strong>{safeAccuracy === null ? "—" : `${safeAccuracy}%`}</strong><small>{safest.length} {language === "es" ? "evaluadas" : "graded"}</small></div><div><span>⚡ {t.upset}</span><strong>{upsetAccuracy === null ? "—" : `${upsetAccuracy}%`}</strong><small>{upsets.length} {language === "es" ? "evaluadas" : "graded"}</small></div><div><span>{language === "es" ? "Partido con más aciertos" : "Most correctly picked game"}</span><strong>{topGame ? `${findTeam(topGame.away).abbr}–${findTeam(topGame.home).abbr}` : "—"}</strong><small>{gameStats ? `${gameStats.correct}/${gameStats.entries} ${t.correct.toLowerCase()}` : (language === "es" ? "Pendiente" : "Pending")}</small></div></section></div>
      <section><h2>{t.nextGames}</h2><div className="games-grid">{games.slice(0, 3).map((game) => <GameCard key={game.id} game={game} compact />)}</div></section>
    </div>;
  }

  function Clusters() {
    const stats = calculateTeamSeasonStats(allGames, "regular");
    const compareTeams = (leftId: string, rightId: string) => stats[rightId].pct - stats[leftId].pct || stats[rightId].diff - stats[leftId].diff || stats[rightId].pf - stats[leftId].pf || findTeam(leftId).city.localeCompare(findTeam(rightId).city);
    const conferenceData = (["AFC", "NFC"] as const).map((conference) => {
      const conferenceTeams = teams.filter((team) => team.conference === conference);
      const divisionLeaders = (["East", "North", "South", "West"] as const).map((division) => conferenceTeams.filter((team) => team.division === division).map((team) => team.id).sort(compareTeams)[0]);
      const remaining = conferenceTeams.map((team) => team.id).filter((teamId) => !divisionLeaders.includes(teamId)).sort(compareTeams);
      const seeds = [...divisionLeaders.sort(compareTeams), ...remaining];
      return { conference, seeds, gamesPlayed: conferenceTeams.reduce((sum, team) => sum + stats[team.id].played, 0) / 2 };
    });
    return <div className="page"><PageHeading title={language === "es" ? "CARRERA A PLAYOFFS" : "PLAYOFF RACE"} subtitle={language === "es" ? "Posición real por porcentaje y diferencial de puntos" : "Live position by win percentage and point differential"} /><div className="playoff-legend"><span><i className="leader-dot" />{language === "es" ? "Líder divisional" : "Division leader"}</span><span><i className="wildcard-dot" />Wild Card</span><span><i className="hunt-dot" />{language === "es" ? "En la pelea" : "In the hunt"}</span></div><div className="playoff-conferences">{conferenceData.map(({ conference, seeds, gamesPlayed }) => <section className="playoff-conference" key={conference}><div className="section-title"><h2 className={`conference ${conference.toLowerCase()}`}>{conference}</h2><span>{gamesPlayed} {language === "es" ? "partidos finalizados" : "final games"}</span></div><div className="cluster-board"><div className="axis y">POINT DIFFERENTIAL</div><div className="axis x">WIN %</div><div className="quadrant q1">ELITE</div><div className="quadrant q2">IN THE HUNT</div><div className="quadrant q3">DEVELOPING</div><div className="quadrant q4">REBUILDING</div>{seeds.map((teamId, index) => { const value = stats[teamId]; const initial = gamesPlayed === 0; const left = initial ? 13 + (index % 4) * 24 : 8 + value.pct * 84; const top = initial ? 18 + Math.floor(index / 4) * 21 : Math.max(8, Math.min(88, 50 - Math.max(-100, Math.min(100, value.diff)) * .38)); const status = index < 4 ? "division-leader" : index < 7 ? "wildcard" : index < 10 ? "hunt" : "outside"; return <span key={teamId} title={`${findTeam(teamId).city} ${findTeam(teamId).name} · ${(value.pct * 100).toFixed(1)}% · ${value.diff >= 0 ? "+" : ""}${value.diff}`} className={`cluster-team ${status}`} style={{ left: `${left}%`, top: `${top}%` }}>{findTeam(teamId).abbr}</span>; })}</div><div className="seed-list">{seeds.slice(0, 7).map((teamId, index) => { const value = stats[teamId]; return <div key={teamId}><span>{index + 1}</span><TeamBadge id={teamId} /><strong>{findTeam(teamId).city}<small>{value.wins}-{value.losses}-{value.ties} · {(value.pct * 100).toFixed(1)}% · {value.diff >= 0 ? "+" : ""}{value.diff}</small></strong><b>{index < 4 ? (language === "es" ? "DIV" : "DIV") : "WC"}</b></div>; })}</div></section>)}</div></div>;
  }

  function FilmRoom() {
    const playedGameIds = [...new Set(filmPlays.map((play) => play.gameId))];
    const latestGame = allGames.filter((game) => playedGameIds.includes(game.id)).sort((left, right) => Date.parse(right.kickoffUtc) - Date.parse(left.kickoffUtc))[0];
    const playTypes = [...new Set(filmPlays.filter((play) => !latestGame || play.gameId === latestGame.id).map((play) => play.playType))].sort();
    const visiblePlays = filmPlays.filter((play) => (!latestGame || play.gameId === latestGame.id) && (!filmQuarter || play.quarter === Number(filmQuarter)) && (!filmType || play.playType === filmType)).sort((left, right) => left.sequence - right.sequence);
    const typeLabels: Record<string, [string, string]> = { pass: ["Pase", "Pass"], run: ["Carrera", "Run"], sack: ["Captura", "Sack"], interception: ["Intercepción", "Interception"], fumble: ["Balón suelto", "Fumble"], punt: ["Despeje", "Punt"], field_goal: ["Gol de campo", "Field goal"], extra_point: ["Punto extra", "Extra point"], two_point: ["Conversión de dos", "Two-point conversion"], kickoff: ["Patada de salida", "Kickoff"], penalty: ["Castigo", "Penalty"], timeout: ["Tiempo fuera", "Timeout"], kneel: ["Rodilla", "Kneel"], spike: ["Pase clavado", "Spike"], other: ["Otra", "Other"] };
    return <div className="page"><PageHeading title={t.filmTitle.toUpperCase()} subtitle={language === "es" ? "Jugadas del último partido de cada equipo, con explicación técnica" : "Every team's latest game plays with technical explanations"} /><section className="film-toolbar panel"><label>{t.team}<select value={filmTeam} onChange={(event) => { setFilmTeam(event.target.value); setFilmQuarter(""); setFilmType(""); }}>{teams.map((team) => <option key={team.id} value={team.id}>{team.abbr} · {team.city} {team.name}</option>)}</select></label><label>{language === "es" ? "Cuarto" : "Quarter"}<select value={filmQuarter} onChange={(event) => setFilmQuarter(event.target.value)}><option value="">{t.all}</option>{[1, 2, 3, 4, 5].map((quarter) => <option key={quarter} value={quarter}>{quarter === 5 ? "OT" : `Q${quarter}`}</option>)}</select></label><label>{language === "es" ? "Tipo de jugada" : "Play type"}<select value={filmType} onChange={(event) => setFilmType(event.target.value)}><option value="">{t.all}</option>{playTypes.map((type) => <option key={type} value={type}>{typeLabels[type]?.[language === "es" ? 0 : 1] || type}</option>)}</select></label></section>{latestGame && <div className="film-game"><TeamBadge id={latestGame.away} /><strong>{findTeam(latestGame.away).abbr} vs {findTeam(latestGame.home).abbr}</strong><TeamBadge id={latestGame.home} /><span>{formatKickoff(latestGame.kickoffUtc)} · {latestGame.venue}</span></div>}{filmLoading ? <div className="empty-state"><BookOpen size={38} /><p>{language === "es" ? "Cargando jugadas…" : "Loading plays…"}</p></div> : visiblePlays.length ? <section className="play-list">{visiblePlays.map((play) => <article className={`${play.scoring ? "scoring" : ""} ${play.turnover ? "turnover" : ""}`} key={play.playId}><div className="play-context"><span>Q{play.quarter} · {play.clock}</span><b>{play.down ? `${play.down}&${play.distance}` : "—"}</b><em>{play.yards > 0 ? `+${play.yards}` : play.yards} YDS</em></div><div className="play-body"><div><span>{typeLabels[play.playType]?.[language === "es" ? 0 : 1] || play.playType}</span>{play.scoring && <b>SCORING</b>}{play.turnover && <b>TURNOVER</b>}</div><h3>{language === "es" ? play.conceptEs : play.conceptEn}</h3><p className="raw-play">{play.descriptionEn}</p><p>{language === "es" ? play.explanationEs : play.explanationEn}</p></div></article>)}</section> : <section className="panel film"><div className="field"><div>20</div><div>40</div><div>50</div><div>40</div><div>20</div><span className="play-line" /></div><div className="empty-state"><BookOpen size={38} /><h2>{language === "es" ? "Esperando el primer kickoff" : "Waiting for the first kickoff"}</h2><p>{t.filmEmpty}</p></div></section>}</div>;
  }

  function Positions() {
    return <div className="page"><PageHeading title={t.anatomy.toUpperCase()} subtitle={language === "es" ? "Las tres unidades: ofensiva, defensiva y equipos especiales" : "All three units: offense, defense, and special teams"} />
      <div className="position-groups">{positionGroups.map((group) => <section className={`panel position-table position-${group.id}`} key={group.id}>
        <div className="position-group-title"><span>{group.id === "offense" ? "O" : group.id === "defense" ? "D" : "ST"}</span><div><h2>{language === "es" ? group.labelEs : group.labelEn}</h2><p>{language === "es" ? `${group.positions.length} posiciones y funciones principales` : `${group.positions.length} positions and primary roles`}</p></div></div>
        <div className="position-head"><span>POS</span><span>{t.englishName}</span><span>{t.spanishName}</span><span>{t.function}</span></div>
        {group.positions.map(([abbr, en, es, roleEs, roleEn]) => <div className="position-row" key={abbr}><strong>{abbr}</strong><span>{en}</span><span>{es}</span><p>{language === "es" ? roleEs : roleEn}</p></div>)}
      </section>)}</div>
    </div>;
  }
}
