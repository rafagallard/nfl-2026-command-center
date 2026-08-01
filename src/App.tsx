import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, CalendarDays, Languages, LayoutDashboard, Shield, Target, Trophy, Users } from "lucide-react";
import { fallbackGames, findTeam, Game, positions, teams } from "./data";

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
}

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
async function loadWeekGames(): Promise<Game[]> {
  try {
    const response = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=1&dates=2026");
    if (!response.ok) return fallbackGames;
    const payload = await response.json();
    const mapped = (payload.events || []).map((event: any): Game | null => {
      const competition = event.competitions?.[0];
      const home = competition?.competitors?.find((item: any) => item.homeAway === "home");
      const away = competition?.competitors?.find((item: any) => item.homeAway === "away");
      const homeTeam = teams.find((team) => team.abbr === home?.team?.abbreviation);
      const awayTeam = teams.find((team) => team.abbr === away?.team?.abbreviation);
      if (!homeTeam || !awayTeam) return null;
      const state = event.status?.type?.state;
      return { id: String(event.id), week: 1, kickoffUtc: event.date, away: awayTeam.id, home: homeTeam.id, venue: competition?.venue?.fullName || "TBD", status: state === "post" ? "final" : state === "in" ? "live" : "scheduled", awayScore: Number(away.score || 0), homeScore: Number(home.score || 0) };
    }).filter(Boolean);
    return mapped.length ? mapped : fallbackGames;
  } catch { return fallbackGames; }
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("nfl-language") as Language) || "es");
  const [view, setView] = useState<View>("home");
  const [games, setGames] = useState<Game[]>(fallbackGames);
  const [predictions, setPredictions] = useState<Prediction[]>(loadPredictions);
  const [message, setMessage] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const t = copy[language];

  useEffect(() => { loadWeekGames().then(setGames); }, []);
  useEffect(() => { localStorage.setItem("nfl-language", language); document.documentElement.lang = language; }, [language]);
  useEffect(() => { localStorage.setItem("nfl-2026-predictions", JSON.stringify(predictions)); }, [predictions]);

  const participants = useMemo(() => [...new Set(predictions.map((p) => p.participantDisplay))].sort(), [predictions]);
  const visibleHistory = predictions.filter((prediction) => (!memberFilter || prediction.participantDisplay === memberFilter) && (!gameFilter || prediction.gameId === gameFilter));

  // This submit path mirrors the future server validation and gives immediate offline behavior.
  function submitPrediction(event: React.FormEvent<HTMLFormElement>) {
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
    if (safe && predictions.some((item) => item.week === game.week && item.participantKey === participantKey && item.safe)) { setMessage(language === "es" ? "Ya registraste una selección segura para esta semana." : "You already submitted a safe pick for this week."); return; }
    if (upset && predictions.some((item) => item.week === game.week && item.participantKey === participantKey && item.upset)) { setMessage(language === "es" ? "Ya registraste una sorpresa para esta semana." : "You already submitted an upset pick for this week."); return; }
    setPredictions((current) => [...current, { id: crypto.randomUUID(), gameId, week: game.week, participantDisplay, participantKey, teamId, safe, upset, submittedAt: new Date().toISOString() }]);
    setMessage(t.saved);
    event.currentTarget.reset();
    setSelectedGameId("");
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
    <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 5).map(({ id, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={20} /><span>{t[id]}</span></button>)}</nav>
    <footer>NFL TRACKER 2026 · {t.source} · {language === "es" ? "Uso personal · No afiliado con la NFL" : "Personal use · Not affiliated with the NFL"}</footer>
  </div>;

  function PageHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div className="page-heading"><p className="eyebrow">NFL TRACKER 2026</p><h1>{title}</h1><p>{subtitle}</p></div>; }
  function TeamBadge({ id }: { id: string }) { const team = findTeam(id); return <span className="team-badge" style={{ "--team": team.color } as React.CSSProperties}>{team.abbr}</span>; }
  function GameCard({ game, compact = false }: { game: Game; compact?: boolean }) { const away = findTeam(game.away); const home = findTeam(game.home); return <article className={`game-card ${compact ? "compact" : ""}`}><div className="game-meta"><span>WEEK {game.week}</span><span>{formatKickoff(game.kickoffUtc)}</span></div><div className="matchup"><div><TeamBadge id={away.id} /><strong>{away.city}</strong><small>{away.name}</small></div><span className="versus">VS</span><div><TeamBadge id={home.id} /><strong>{home.city}</strong><small>{home.name} · HOME</small></div></div><p className="venue">{game.venue}</p></article>; }

  function Home() { return <div className="page"><PageHeading title={t.title} subtitle={t.subtitle} /><section className="summary-grid"><div><span>{t.nextGames}</span><strong>{games.length}</strong><small>WEEK 1</small></div><div><span>{t.records}</span><strong>{predictions.length}</strong><small>{participants.length} {language === "es" ? "participantes" : "participants"}</small></div><div><span>{t.localTime}</span><strong>{Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace("_", " ")}</strong><small>{language === "es" ? "Detectada automáticamente" : "Detected automatically"}</small></div><div><span>{language === "es" ? "Partidos jugados" : "Games played"}</span><strong>0</strong><small>2026 REGULAR SEASON</small></div></section><section><div className="section-title"><h2>{t.nextGames}</h2><button onClick={() => setView("predictions")}>{t.register}</button></div><div className="games-grid">{games.map((game) => <GameCard key={game.id} game={game} />)}</div></section></div>; }

  function Standings() { return <div className="page"><PageHeading title={language === "es" ? "CLASIFICACIONES NFL 2026" : "NFL 2026 STANDINGS"} subtitle={language === "es" ? "Pretemporada · Todos los equipos comienzan 0–0" : "Preseason · Every team starts 0–0"} /><div className="conference-columns">{(["AFC", "NFC"] as const).map((conference) => <section key={conference}><h2 className={`conference ${conference.toLowerCase()}`}>{conference}</h2>{(["East", "North", "South", "West"] as const).map((division) => <div className="division-card" key={division}><div className="division-title"><span>{conference}</span><strong>{division.toUpperCase()}</strong></div><div className="standings-head"><span>{t.team}</span><span>W</span><span>L</span><span>PCT</span><span>PF</span><span>DIFF</span></div>{teams.filter((team) => team.conference === conference && team.division === division).map((team) => <div className="standings-row" key={team.id}><span><TeamBadge id={team.id} /><b>{team.abbr}</b><em>{team.city}</em></span><span>0</span><span>0</span><span>.000</span><span>0</span><span>0</span></div>)}</div>)}</section>)}</div></div>; }

  function Predictions() {
    const selectedGame = games.find((game) => game.id === selectedGameId);
    const eligibleTeams = selectedGame ? [findTeam(selectedGame.away), findTeam(selectedGame.home)] : [];
    return <div className="page"><PageHeading title={language === "es" ? "PRONÓSTICOS" : "PREDICTIONS"} subtitle={t.noScore} /><div className="prediction-layout"><section className="panel"><h2>{t.register}</h2><form className="prediction-form" onSubmit={submitPrediction}><label>{t.participant}<input name="participant" required minLength={3} autoComplete="name" placeholder={language === "es" ? "Escribe tu nombre" : "Enter your name"} /></label><label>{language === "es" ? "Partido" : "Game"}<select name="gameId" required value={selectedGameId} onChange={(event) => { setSelectedGameId(event.target.value); setMessage(""); }}><option value="" disabled>{language === "es" ? "Selecciona un partido" : "Select a game"}</option>{games.map((game) => <option key={game.id} value={game.id}>{findTeam(game.away).abbr} vs {findTeam(game.home).abbr} · {formatKickoff(game.kickoffUtc)}</option>)}</select></label><label>{t.choose}<select key={selectedGameId} name="teamId" required defaultValue="" disabled={!selectedGame}><option value="" disabled>{language === "es" ? "Selecciona un equipo" : "Select a team"}</option>{eligibleTeams.map((team) => <option key={team.id} value={team.id}>{team.city} {team.name}</option>)}</select></label><div className="check-row"><label><input type="checkbox" name="safe" /> {t.safe}</label><label><input type="checkbox" name="upset" /> {t.upset}</label></div><button className="primary" type="submit">{t.save}</button>{message && <p className={message === t.saved ? "form-success" : "form-error"} role="status">{message}</p>}</form></section><section className="panel history-panel"><div className="section-title"><h2>{t.history}</h2><span>{visibleHistory.length}</span></div><div className="filter-row"><select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}><option value="">{t.filterMember}: {t.all}</option>{participants.map((name) => <option key={name}>{name}</option>)}</select><select value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}><option value="">{t.filterGame}: {t.all}</option>{games.map((game) => <option key={game.id} value={game.id}>{findTeam(game.away).abbr} vs {findTeam(game.home).abbr}</option>)}</select></div>{visibleHistory.length === 0 ? <div className="empty-state"><Target size={34} /><p>{t.empty}</p></div> : <div className="history-list">{visibleHistory.map((prediction) => { const game = games.find((item) => item.id === prediction.gameId); const revealed = game ? Date.now() >= Date.parse(game.kickoffUtc) : false; return <article key={prediction.id}><div><strong>{prediction.participantDisplay}</strong><small>{game ? `${findTeam(game.away).abbr} vs ${findTeam(game.home).abbr}` : prediction.gameId}</small></div>{revealed ? <TeamBadge id={prediction.teamId} /> : <span className="team-badge">•••</span>}<span>{revealed ? (prediction.safe ? "★ SAFE" : prediction.upset ? "⚡ UPSET" : t.scheduled) : (language === "es" ? "Oculto hasta el kickoff" : "Hidden until kickoff")}</span></article>; })}</div>}</section></div></div>;
  }

  function Dashboard() { const topTeam = Object.entries(predictions.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.teamId]: (acc[item.teamId] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]; return <div className="page"><PageHeading title="DASHBOARD" subtitle={language === "es" ? "Resumen de participación y temporada 2026" : "Participation and 2026 season overview"} /><section className="summary-grid"><div><span>{language === "es" ? "Participantes" : "Participants"}</span><strong>{participants.length}</strong><small>{t.records}</small></div><div><span>{t.records}</span><strong>{predictions.length}</strong><small>WEEK 1</small></div><div><span>{t.accuracy}</span><strong>—</strong><small>{language === "es" ? "Disponible al terminar partidos" : "Available after final games"}</small></div><div><span>{t.popular}</span><strong>{topTeam ? findTeam(topTeam[0]).abbr : "—"}</strong><small>{topTeam ? `${topTeam[1]} ${t.records.toLowerCase()}` : t.empty}</small></div></section><section className="panel"><h2>{language === "es" ? "Actividad por participante" : "Activity by participant"}</h2>{participants.length ? <div className="leaderboard">{participants.map((name, index) => { const count = predictions.filter((item) => item.participantDisplay === name).length; return <div key={name}><span>{index + 1}</span><strong>{name}</strong><div><i style={{ width: `${Math.min(100, count * 12)}%` }} /></div><b>{count}</b></div>; })}</div> : <div className="empty-state"><Users size={34} /><p>{t.empty}</p></div>}</section><section><h2>{t.nextGames}</h2><div className="games-grid">{games.slice(0, 3).map((game) => <GameCard key={game.id} game={game} compact />)}</div></section></div>; }

  function Clusters() { return <div className="page"><PageHeading title={language === "es" ? "CARRERA A PLAYOFFS" : "PLAYOFF RACE"} subtitle={language === "es" ? "Clúster por conferencia · Se activará con los resultados de 2026" : "Conference clusters · Activates with 2026 results"} /><div className="cluster-legend"><span><i className="afc-dot" />AFC (16)</span><span><i className="nfc-dot" />NFC (16)</span></div><section className="cluster-board"><div className="axis y">POINT DIFFERENTIAL</div><div className="axis x">WIN %</div><div className="quadrant q1">ELITE</div><div className="quadrant q2">IN THE HUNT</div><div className="quadrant q3">DEVELOPING</div><div className="quadrant q4">REBUILDING</div>{teams.map((team, index) => <span key={team.id} className={`cluster-team ${team.conference.toLowerCase()}`} style={{ left: `${18 + ((index * 17) % 68)}%`, top: `${17 + ((index * 29) % 68)}%` }}>{team.abbr}</span>)}</section></div>; }

  function FilmRoom() { return <div className="page"><PageHeading title={t.filmTitle.toUpperCase()} subtitle={language === "es" ? "Explora las jugadas del último partido de cada equipo" : "Explore every team's most recent game plays"} /><section className="panel film"><div className="field"><div>20</div><div>40</div><div>50</div><div>40</div><div>20</div><span className="play-line" /></div><div className="empty-state"><BookOpen size={38} /><h2>{language === "es" ? "Esperando el primer kickoff" : "Waiting for the first kickoff"}</h2><p>{t.filmEmpty}</p></div></section></div>; }

  function Positions() { return <div className="page"><PageHeading title={t.anatomy.toUpperCase()} subtitle={language === "es" ? "Abreviaciones, nombres y funciones principales" : "Abbreviations, names and primary roles"} /><section className="panel position-table"><div className="position-head"><span>POS</span><span>{t.englishName}</span><span>{t.spanishName}</span><span>{t.function}</span></div>{positions.map(([abbr, en, es, role]) => <div className="position-row" key={abbr}><strong>{abbr}</strong><span>{en}</span><span>{es}</span><p>{language === "es" ? role : translateRole(role)}</p></div>)}</section></div>; }
}

function translateRole(role: string) {
  const map: Record<string, string> = {
    "Dirige la ofensiva, lee la defensa y entrega o lanza el balón.": "Leads the offense, reads the defense, and hands off or throws the ball.",
    "Corre con el balón, recibe pases cortos y ayuda en protección.": "Runs the ball, catches short passes, and helps in protection.",
    "Corredor de poder": "Power back",
    "Bloquea, participa en corto yardaje y sirve como opción de pase.": "Blocks, handles short yardage, and serves as a receiving option.",
    "Corre rutas para crear separación y recibir pases.": "Runs routes to create separation and catch passes.",
    "Combina funciones de receptor y bloqueador.": "Combines receiving and blocking duties.",
    "Protege al quarterback y abre carriles para la carrera.": "Protects the quarterback and opens running lanes.",
    "Controla el interior y presiona al quarterback.": "Controls the interior and pressures the quarterback.",
    "Contiene la carrera exterior y busca capturas.": "Sets the edge and pursues sacks.",
    "Defiende carrera, cubre pases y participa en cargas.": "Defends the run, covers passes, and blitzes.",
    "Cubre receptores y defiende pases exteriores.": "Covers receivers and defends outside passes.",
    "Protege la zona profunda y apoya contra la carrera.": "Protects the deep field and supports run defense.",
    "Ejecuta las jugadas especializadas de patada.": "Handles specialized kicking plays.",
  };
  return map[role] || role;
}
