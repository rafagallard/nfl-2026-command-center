import type { Conference, Division, Game, Team } from "./data";

/**
 * NFL-style provisional conference ranking.
 * Uses completed REGULAR-season games only. No point differential is used
 * before the published head-to-head / division / conference tiebreakers.
 * Official playoff clinches and final multi-club adjudication remain NFL-owned.
 */
type RecordLine = { wins: number; losses: number; ties: number; played: number; pct: number; pf: number; pa: number; diff: number };
type TieKind = "division" | "conference";
type Criterion = { name: string; score: (id: string, tied: string[]) => number | null };
export type ConferenceRace = {
  ranked: string[];
  leaders: Set<string>;
  criterionByTeam: Record<string, string>;
};

const divisions: Division[] = ["East", "North", "South", "West"];

export function rankConference(teams: Team[], allGames: Game[], conference: Conference): ConferenceRace {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const finished = allGames.filter((game) => game.status === "final" &&
    game.kickoffUtc >= "2026-09-01" && game.kickoffUtc < "2027-01-12" &&
    teamById.has(game.away) && teamById.has(game.home));
  const conferenceTeams = teams.filter((team) => team.conference === conference);
  const line = (id: string, source = finished): RecordLine => {
    const games = source.filter((game) => game.away === id || game.home === id);
    const result = games.reduce((acc, game) => {
      const forPoints = Number(game.away === id ? game.awayScore : game.homeScore) || 0;
      const against = Number(game.away === id ? game.homeScore : game.awayScore) || 0;
      acc.pf += forPoints; acc.pa += against;
      if (forPoints > against) acc.wins++;
      else if (forPoints < against) acc.losses++;
      else acc.ties++;
      return acc;
    }, { wins: 0, losses: 0, ties: 0, played: 0, pct: 0, pf: 0, pa: 0, diff: 0 });
    result.played = games.length;
    result.pct = games.length ? (result.wins + result.ties / 2) / games.length : 0;
    result.diff = result.pf - result.pa;
    return result;
  };
  const records = new Map(teams.map((team) => [team.id, line(team.id)]));
  const record = (id: string) => records.get(id)!;
  const inDivision = (a: string, b: string) => teamById.get(a)?.division === teamById.get(b)?.division &&
    teamById.get(a)?.conference === teamById.get(b)?.conference;
  const pct = (id: string, games: Game[]) => games.some((game) => game.away === id || game.home === id) ?
    line(id, games).pct : null;
  const between = (set: string[]) => finished.filter((game) => set.includes(game.away) && set.includes(game.home));
  const divisionGames = (id: string) => finished.filter((game) => [game.home, game.away].includes(id) &&
    inDivision(game.home, game.away));
  const conferenceGames = (id: string) => finished.filter((game) =>
    (game.home === id || game.away === id) &&
    teamById.get(game.home)?.conference === teamById.get(game.away)?.conference);
  const opponents = (id: string) => finished.filter((game) => game.home === id || game.away === id)
    .map((game) => game.home === id ? game.away : game.home);
  const common = (tied: string[]) => {
    const opponentsByTeam = tied.map((id) => new Set(opponents(id)));
    const shared = [...opponentsByTeam[0]].filter((opponent) =>
      !tied.includes(opponent) && opponentsByTeam.every((set) => set.has(opponent)));
    return finished.filter((game) =>
      shared.includes(game.home) || shared.includes(game.away));
  };
  const commonPct = (id: string, tied: string[], minFour: boolean) => {
    const games = common(tied).filter((game) => game.home === id || game.away === id);
    return games.length >= (minFour ? 4 : 1) ? pct(id, games) : null;
  };
  const strength = (id: string, victoriesOnly: boolean) => {
    const games = finished.filter((game) => {
      if (game.home !== id && game.away !== id) return false;
      if (!victoriesOnly) return true;
      return Number(game.home === id ? game.homeScore : game.awayScore) >
        Number(game.home === id ? game.awayScore : game.homeScore);
    });
    if (!games.length) return null;
    return games.reduce((sum, game) => {
      const opponent = game.home === id ? game.away : game.home;
      return sum + record(opponent).pct;
    }, 0) / games.length;
  };
  const combinedRanking = (id: string, withinConference: boolean) => {
    const pool = withinConference ? conferenceTeams : teams;
    const own = record(id);
    const higherScoring = pool.filter((team) => record(team.id).pf > own.pf).length;
    const fewerAllowed = pool.filter((team) => record(team.id).pa < own.pa).length;
    // Lower combined rank wins: negate to keep the criterion's maximize convention.
    return -(2 + higherScoring + fewerAllowed);
  };
  const net = (id: string, games: Game[]) => line(id, games).diff;
  const headToHead = (id: string, tied: string[]) => {
    if (tied.length === 2) {
      const games = between(tied);
      return games.length ? pct(id, games) : null;
    }
    // Multi-club division head-to-head only when every pair has already met.
    for (let i = 0; i < tied.length; i++) {
      for (let j = i + 1; j < tied.length; j++) {
        if (!between([tied[i], tied[j]]).length) return null;
      }
    }
    return pct(id, between(tied));
  };
  const sweep = (id: string, tied: string[]) => {
    if (tied.length === 2) return headToHead(id, tied);
    const games = between(tied).filter((game) => game.home === id || game.away === id);
    const opponentsMet = new Set(games.map((game) => game.home === id ? game.away : game.home));
    if (!tied.every((team) => team === id || opponentsMet.has(team))) return null;
    const performance = line(id, games);
    if (performance.wins === games.length) return 1;
    if (performance.losses === games.length) return -1;
    return 0;
  };
  const divisionCriteria: Criterion[] = [
    { name: "duelos directos", score: headToHead },
    { name: "récord divisional", score: (id) => pct(id, divisionGames(id)) },
    { name: "rivales comunes", score: (id, tied) => commonPct(id, tied, false) },
    { name: "récord de conferencia", score: (id) => pct(id, conferenceGames(id)) },
    { name: "fortaleza de victorias", score: (id) => strength(id, true) },
    { name: "fortaleza de calendario", score: (id) => strength(id, false) },
    { name: "ranking combinado de puntos de conferencia", score: (id) => combinedRanking(id, true) },
    { name: "ranking combinado de puntos NFL", score: (id) => combinedRanking(id, false) },
    { name: "diferencial frente a rivales comunes", score: (id, tied) => net(id, common(tied)) },
    { name: "diferencial total", score: (id) => record(id).diff }
  ];
  const conferenceCriteria: Criterion[] = [
    { name: "duelos directos", score: sweep },
    { name: "récord de conferencia", score: (id) => pct(id, conferenceGames(id)) },
    { name: "rivales comunes (mínimo cuatro)", score: (id, tied) => commonPct(id, tied, true) },
    ...divisionCriteria.slice(4, 8),
    { name: "diferencial en conferencia", score: (id) => net(id, conferenceGames(id)) },
    { name: "diferencial total", score: (id) => record(id).diff }
  ];
  const criterionByTeam: Record<string, string> = {};
  const choose = (ids: string[], kind: TieKind): string => {
    if (ids.length === 1) return ids[0];
    let candidates = ids;
    const criteria = kind === "division" ? divisionCriteria : conferenceCriteria;
    let previousSize = candidates.length;
    for (let restart = 0; restart < 12; restart++) {
      let narrowed = false;
      for (const criterion of criteria) {
        const values = candidates.map((id) => criterion.score(id, candidates));
        // An incomplete comparison cannot establish a tiebreaker.
        if (values.some((value) => value === null || !Number.isFinite(value))) continue;
        const highest = Math.max(...values as number[]);
        const winners = candidates.filter((_, index) => Math.abs((values[index] as number) - highest) < 1e-9);
        if (winners.length === 1) {
          criterionByTeam[winners[0]] = criterion.name;
          return winners[0];
        }
        if (winners.length < candidates.length) {
          candidates = winners;
          narrowed = true;
          break; // Restart the appropriate tiebreaker when the candidate pool shrinks.
        }
      }
      if (!narrowed || candidates.length === previousSize) break;
      previousSize = candidates.length;
    }
    // Official steps after point differential can require play-by-play TD data or a coin toss.
    // Use stable ordering, but mark the result as unresolved, never as an official NFL seed.
    const fallback = [...candidates].sort()[0];
    criterionByTeam[fallback] = "empate sin resolver";
    return fallback;
  };
  const rank = (ids: string[], kind: TieKind, divisionOrder?: Record<string, number>) => {
    const remaining = [...ids];
    const sorted: string[] = [];
    while (remaining.length) {
      const maxPct = Math.max(...remaining.map((id) => record(id).pct));
      let contenders = remaining.filter((id) => Math.abs(record(id).pct - maxPct) < 1e-9);
      if (kind === "conference" && contenders.length > 1 && divisionOrder) {
        // Only the highest remaining club from each division enters a multi-division tie.
        const representative = new Map<Division, string>();
        for (const id of contenders) {
          const division = teamById.get(id)!.division;
          const current = representative.get(division);
          if (!current || divisionOrder[id] < divisionOrder[current]) representative.set(division, id);
        }
        contenders = [...representative.values()];
      }
      const winner = choose(contenders, kind);
      sorted.push(winner);
      remaining.splice(remaining.indexOf(winner), 1);
    }
    return sorted;
  };
  const divisionRanked = divisions.map((division) =>
    rank(conferenceTeams.filter((team) => team.division === division).map((team) => team.id), "division"));
  const leaders = new Set(divisionRanked.map((ids) => ids[0]));
  const divisionOrder: Record<string, number> = {};
  divisionRanked.forEach((ids) => ids.forEach((id, index) => { divisionOrder[id] = index; }));
  const leaderOrder = rank([...leaders], "conference", divisionOrder);
  const wildcards = rank(conferenceTeams.map((team) => team.id).filter((id) => !leaders.has(id)), "conference", divisionOrder);
  return { ranked: [...leaderOrder, ...wildcards], leaders, criterionByTeam };
}
