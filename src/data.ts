export type Conference = "AFC" | "NFC";
export type Division = "East" | "North" | "South" | "West";

export interface Team {
  id: string;
  abbr: string;
  city: string;
  name: string;
  conference: Conference;
  division: Division;
  color: string;
}

export interface Game {
  id: string;
  week: number;
  kickoffUtc: string;
  away: string;
  home: string;
  venue: string;
  status: "scheduled" | "live" | "final" | "postponed";
  awayScore?: number;
  homeScore?: number;
}

export interface ScheduleSlot {
  id: string;
  phase: "hall-of-fame" | "preseason" | "regular" | "postseason";
  seasonType: 1 | 2 | 3;
  espnWeek: number;
  displayWeek: number;
  labelEs: string;
  labelEn: string;
}

export const teams: Team[] = [
  ["ari", "ARI", "Arizona", "Cardinals", "NFC", "West", "#97233f"],
  ["atl", "ATL", "Atlanta", "Falcons", "NFC", "South", "#a71930"],
  ["bal", "BAL", "Baltimore", "Ravens", "AFC", "North", "#241773"],
  ["buf", "BUF", "Buffalo", "Bills", "AFC", "East", "#00338d"],
  ["car", "CAR", "Carolina", "Panthers", "NFC", "South", "#0085ca"],
  ["chi", "CHI", "Chicago", "Bears", "NFC", "North", "#0b162a"],
  ["cin", "CIN", "Cincinnati", "Bengals", "AFC", "North", "#fb4f14"],
  ["cle", "CLE", "Cleveland", "Browns", "AFC", "North", "#311d00"],
  ["dal", "DAL", "Dallas", "Cowboys", "NFC", "East", "#003594"],
  ["den", "DEN", "Denver", "Broncos", "AFC", "West", "#fb4f14"],
  ["det", "DET", "Detroit", "Lions", "NFC", "North", "#0076b6"],
  ["gb", "GB", "Green Bay", "Packers", "NFC", "North", "#203731"],
  ["hou", "HOU", "Houston", "Texans", "AFC", "South", "#03202f"],
  ["ind", "IND", "Indianapolis", "Colts", "AFC", "South", "#002c5f"],
  ["jax", "JAX", "Jacksonville", "Jaguars", "AFC", "South", "#006778"],
  ["kc", "KC", "Kansas City", "Chiefs", "AFC", "West", "#e31837"],
  ["lv", "LV", "Las Vegas", "Raiders", "AFC", "West", "#000000"],
  ["lac", "LAC", "Los Angeles", "Chargers", "AFC", "West", "#0080c6"],
  ["lar", "LAR", "Los Angeles", "Rams", "NFC", "West", "#003594"],
  ["mia", "MIA", "Miami", "Dolphins", "AFC", "East", "#008e97"],
  ["min", "MIN", "Minnesota", "Vikings", "NFC", "North", "#4f2683"],
  ["ne", "NE", "New England", "Patriots", "AFC", "East", "#002244"],
  ["no", "NO", "New Orleans", "Saints", "NFC", "South", "#d3bc8d"],
  ["nyg", "NYG", "New York", "Giants", "NFC", "East", "#0b2265"],
  ["nyj", "NYJ", "New York", "Jets", "AFC", "East", "#125740"],
  ["phi", "PHI", "Philadelphia", "Eagles", "NFC", "East", "#004c54"],
  ["pit", "PIT", "Pittsburgh", "Steelers", "AFC", "North", "#ffb612"],
  ["sf", "SF", "San Francisco", "49ers", "NFC", "West", "#aa0000"],
  ["sea", "SEA", "Seattle", "Seahawks", "NFC", "West", "#002244"],
  ["tb", "TB", "Tampa Bay", "Buccaneers", "NFC", "South", "#d50a0a"],
  ["ten", "TEN", "Tennessee", "Titans", "AFC", "South", "#0c2340"],
  ["was", "WAS", "Washington", "Commanders", "NFC", "East", "#5a1414"],
].map(([id, abbr, city, name, conference, division, color]) => ({
  id,
  abbr,
  city,
  name,
  conference,
  division,
  color,
})) as Team[];

// These published 2026 fixtures keep the interface useful if the live source is temporarily unavailable.
export const hallOfFameGame: Game[] = [
  { id: "2026-hof-car-ari", week: 0, kickoffUtc: "2026-08-07T00:00:00Z", away: "car", home: "ari", venue: "Tom Benson Hall of Fame Stadium", status: "scheduled" },
];

export const fallbackGames: Game[] = [
  { id: "2026-w1-sf-lar", week: 1, kickoffUtc: "2026-09-10T00:35:00Z", away: "sf", home: "lar", venue: "Melbourne Cricket Ground", status: "scheduled" },
  { id: "2026-w1-dal-nyg", week: 1, kickoffUtc: "2026-09-14T00:20:00Z", away: "dal", home: "nyg", venue: "MetLife Stadium", status: "scheduled" },
  { id: "2026-w1-den-kc", week: 1, kickoffUtc: "2026-09-15T00:15:00Z", away: "den", home: "kc", venue: "Arrowhead Stadium", status: "scheduled" },
  { id: "2026-w1-sea-ne", week: 1, kickoffUtc: "2026-09-13T17:00:00Z", away: "sea", home: "ne", venue: "Gillette Stadium", status: "scheduled" },
];

// ESPN numbers the Hall of Fame game as preseason week 1; the three full
// preseason rounds therefore map to ESPN weeks 2–4.
export const scheduleSlots: ScheduleSlot[] = [
  { id: "hof", phase: "hall-of-fame", seasonType: 1, espnWeek: 1, displayWeek: 0, labelEs: "Hall of Fame", labelEn: "Hall of Fame" },
  ...[1, 2, 3].map((week) => ({ id: `pre-${week}`, phase: "preseason" as const, seasonType: 1 as const, espnWeek: week + 1, displayWeek: week, labelEs: `Pretemporada · Semana ${week}`, labelEn: `Preseason · Week ${week}` })),
  ...Array.from({ length: 18 }, (_, index) => { const week = index + 1; return { id: `reg-${week}`, phase: "regular" as const, seasonType: 2 as const, espnWeek: week, displayWeek: week, labelEs: `Temporada regular · Semana ${week}`, labelEn: `Regular season · Week ${week}` }; }),
  { id: "post-1", phase: "postseason", seasonType: 3, espnWeek: 1, displayWeek: 1, labelEs: "Playoffs · Comodines", labelEn: "Playoffs · Wild Card" },
  { id: "post-2", phase: "postseason", seasonType: 3, espnWeek: 2, displayWeek: 2, labelEs: "Playoffs · Divisional", labelEn: "Playoffs · Divisional" },
  { id: "post-3", phase: "postseason", seasonType: 3, espnWeek: 3, displayWeek: 3, labelEs: "Finales de conferencia", labelEn: "Conference Championships" },
  { id: "post-5", phase: "postseason", seasonType: 3, espnWeek: 5, displayWeek: 5, labelEs: "Super Bowl LXI", labelEn: "Super Bowl LXI" },
];

export type Position = [abbr: string, englishName: string, spanishName: string, roleEs: string, roleEn: string];

// Keep the three football units separate so the position guide is easy to scan
// and every abbreviation can be explained without hiding several jobs in one row.
export const positionGroups: { id: "offense" | "defense" | "special"; labelEs: string; labelEn: string; positions: Position[] }[] = [
  {
    id: "offense", labelEs: "Ofensiva", labelEn: "Offense", positions: [
      ["QB", "Quarterback", "Mariscal de campo", "Dirige la ofensiva, lee la defensa y entrega o lanza el balón.", "Leads the offense, reads the defense, and hands off or throws the ball."],
      ["RB/HB", "Running Back / Halfback", "Corredor", "Corre con el balón, recibe pases y ayuda en protección.", "Runs the ball, catches passes, and helps in pass protection."],
      ["FB", "Fullback", "Corredor de poder", "Bloquea, participa en corto yardaje y sirve como opción de pase.", "Blocks, handles short-yardage situations, and serves as a receiving option."],
      ["WR", "Wide Receiver", "Receptor abierto", "Corre rutas para crear separación y recibir pases.", "Runs routes to create separation and catch passes."],
      ["TE", "Tight End", "Ala cerrada", "Combina funciones de receptor y bloqueador.", "Combines receiving and blocking duties."],
      ["LT", "Left Tackle", "Tackle izquierdo", "Protege el lado izquierdo de la línea y, normalmente, el lado ciego del quarterback.", "Protects the left edge of the line and usually the quarterback's blind side."],
      ["RT", "Right Tackle", "Tackle derecho", "Protege el extremo derecho de la línea y bloquea en jugadas de carrera.", "Protects the right edge of the line and blocks on running plays."],
      ["LG", "Left Guard", "Guardia izquierdo", "Bloquea en el interior izquierdo y abre carriles para la carrera.", "Blocks on the left interior and opens running lanes."],
      ["RG", "Right Guard", "Guardia derecho", "Bloquea en el interior derecho y ayuda a proteger el bolsillo.", "Blocks on the right interior and helps protect the pocket."],
      ["C", "Center", "Centro", "Inicia la jugada con el snap y coordina las asignaciones de bloqueo.", "Starts the play with the snap and coordinates blocking assignments."],
    ],
  },
  {
    id: "defense", labelEs: "Defensiva", labelEn: "Defense", positions: [
      ["DT", "Defensive Tackle", "Tackle defensivo", "Ataca los huecos interiores, detiene la carrera y presiona al quarterback.", "Attacks interior gaps, stops the run, and pressures the quarterback."],
      ["NT", "Nose Tackle", "Tackle nariz", "Ocupa bloqueadores frente al centro y protege el interior de la defensa.", "Occupies blockers over the center and anchors the interior defense."],
      ["DE", "Defensive End", "Ala defensiva", "Contiene la carrera exterior y presiona desde el extremo de la línea.", "Sets the edge against the run and rushes from the end of the line."],
      ["EDGE", "Edge Rusher", "Cazador de quarterback por el borde", "Se especializa en atacar al quarterback desde el borde de la formación.", "Specializes in attacking the quarterback from the edge of the formation."],
      ["MLB", "Middle Linebacker", "Apoyador medio", "Lee la ofensiva, dirige ajustes y organiza la parte central de la defensa.", "Reads the offense, calls adjustments, and organizes the middle of the defense."],
      ["ILB", "Inside Linebacker", "Apoyador interior", "Defiende la carrera entre los tackles y cubre las zonas cortas interiores.", "Defends the run between the tackles and covers underneath inside zones."],
      ["OLB", "Outside Linebacker", "Apoyador exterior", "Cubre zonas cortas, contiene la carrera y puede cargar al quarterback.", "Covers underneath zones, contains the run, and can rush the quarterback."],
      ["CB", "Cornerback", "Esquinero", "Marca receptores y disputa pases cerca de las bandas.", "Covers receivers and contests passes near the sidelines."],
      ["NB", "Nickelback", "Esquinero níquel", "Cubre al receptor interior cuando la defensa utiliza cinco backs defensivos.", "Covers the slot receiver when the defense uses five defensive backs."],
      ["FS", "Free Safety", "Safety libre", "Protege la zona profunda y ayuda en cobertura de pase.", "Protects the deep field and provides help in pass coverage."],
      ["SS", "Strong Safety", "Safety fuerte", "Apoya contra la carrera y cubre alas cerradas o zonas cortas.", "Supports the run and covers tight ends or underneath zones."],
    ],
  },
  {
    id: "special", labelEs: "Equipos especiales", labelEn: "Special Teams", positions: [
      ["K", "Kicker", "Pateador", "Ejecuta goles de campo, puntos extra y, normalmente, patadas de salida.", "Kicks field goals, extra points, and usually kickoffs."],
      ["P", "Punter", "Despejador", "Despeja el balón para ganar posición de campo cuando termina una serie ofensiva.", "Punts to gain field position when an offensive drive ends."],
      ["LS", "Long Snapper", "Centro largo", "Entrega snaps largos y precisos al holder o al despejador.", "Delivers long, accurate snaps to the holder or punter."],
      ["H", "Holder", "Sujetador", "Recibe el snap y coloca el balón para goles de campo y puntos extra.", "Receives the snap and places the ball for field goals and extra points."],
      ["KR", "Kick Returner", "Retornador de patadas de salida", "Recibe kickoffs y busca avanzar el balón para mejorar la posición de campo.", "Returns kickoffs to improve field position."],
      ["PR", "Punt Returner", "Retornador de despejes", "Recibe despejes, decide si pide recepción libre y busca yardas de retorno.", "Fields punts, decides when to call a fair catch, and seeks return yardage."],
      ["GUN", "Gunner", "Artillero", "Baja rápidamente por la banda para detener al retornador en despejes.", "Sprints downfield near the sideline to tackle the punt returner."],
      ["PP", "Punt Protector", "Protector de despeje", "Organiza la protección y bloquea la presión frente al despejador.", "Organizes protection and blocks pressure in front of the punter."],
    ],
  },
];

export const findTeam = (id: string) => teams.find((team) => team.id === id)!;
