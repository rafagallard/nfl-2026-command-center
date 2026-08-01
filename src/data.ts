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
export const fallbackGames: Game[] = [
  { id: "2026-w1-sf-lar", week: 1, kickoffUtc: "2026-09-10T00:35:00Z", away: "sf", home: "lar", venue: "Melbourne Cricket Ground", status: "scheduled" },
  { id: "2026-w1-dal-nyg", week: 1, kickoffUtc: "2026-09-14T00:20:00Z", away: "dal", home: "nyg", venue: "MetLife Stadium", status: "scheduled" },
  { id: "2026-w1-den-kc", week: 1, kickoffUtc: "2026-09-15T00:15:00Z", away: "den", home: "kc", venue: "Arrowhead Stadium", status: "scheduled" },
  { id: "2026-w1-sea-ne", week: 1, kickoffUtc: "2026-09-13T17:00:00Z", away: "sea", home: "ne", venue: "Gillette Stadium", status: "scheduled" },
];

export const positions = [
  ["QB", "Quarterback", "Mariscal de campo", "Dirige la ofensiva, lee la defensa y entrega o lanza el balón."],
  ["RB", "Running Back", "Corredor", "Corre con el balón, recibe pases cortos y ayuda en protección."],
  ["FB", "Fullback", "Corredor de poder", "Bloquea, participa en corto yardaje y sirve como opción de pase."],
  ["WR", "Wide Receiver", "Receptor abierto", "Corre rutas para crear separación y recibir pases."],
  ["TE", "Tight End", "Ala cerrada", "Combina funciones de receptor y bloqueador."],
  ["LT/LG/C/RG/RT", "Offensive Line", "Línea ofensiva", "Protege al quarterback y abre carriles para la carrera."],
  ["DT/NT", "Defensive Tackle / Nose Tackle", "Tackle defensivo", "Controla el interior y presiona al quarterback."],
  ["DE/EDGE", "Defensive End / Edge Rusher", "Ala defensiva", "Contiene la carrera exterior y busca capturas."],
  ["LB", "Linebacker", "Apoyador", "Defiende carrera, cubre pases y participa en cargas."],
  ["CB", "Cornerback", "Esquinero", "Cubre receptores y defiende pases exteriores."],
  ["FS/SS", "Free Safety / Strong Safety", "Safety libre / fuerte", "Protege la zona profunda y apoya contra la carrera."],
  ["K/P/LS", "Kicker / Punter / Long Snapper", "Pateador / despejador / centro largo", "Ejecuta las jugadas especializadas de patada."],
];

export const findTeam = (id: string) => teams.find((team) => team.id === id)!;
