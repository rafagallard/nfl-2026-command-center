import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile("src/tiebreakers.ts", "utf8");
const js = (await transform(source, { loader: "ts", format: "esm" })).code;
const { rankConference } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const teams = [
  { id: "den", city: "Denver", conference: "AFC", division: "West" },
  { id: "kc", city: "Kansas City", conference: "AFC", division: "West" },
  { id: "lac", city: "Los Angeles", conference: "AFC", division: "West" },
  { id: "lv", city: "Las Vegas", conference: "AFC", division: "West" },
  { id: "buf", city: "Buffalo", conference: "AFC", division: "East" },
  { id: "mia", city: "Miami", conference: "AFC", division: "East" },
  { id: "nyj", city: "New York", conference: "AFC", division: "East" },
  { id: "ne", city: "New England", conference: "AFC", division: "East" },
];
let nextId = 1;
const game = (away, home, awayScore, homeScore, status = "final") => ({
  id: String(nextId++), week: 1, kickoffUtc: "2026-10-01T18:00:00Z",
  away, home, awayScore, homeScore, status, venue: "Test",
});

// Two clubs at 2-1: split head-to-head, Denver better within division,
// Kansas City has far better overall scoring margin.
const divisionWins = [
  game("den", "kc", 10, 45),
  game("kc", "den", 7, 10),
  game("den", "lac", 10, 9),
  game("kc", "buf", 50, 0)
];
const result = rankConference(teams, divisionWins, "AFC");
assert(result.leaders.has("den"), "Denver must lead division after the 1-1 H2H split and superior division record");
assert(!result.leaders.has("kc"), "Kansas City cannot lead using overall point differential alone");
assert.equal(result.criterionByTeam.den, "récord divisional");

// When Kansas City wins the direct match, it must lead regardless of Denver's point margin.
const direct = [game("den", "kc", 60, 61), game("den", "lac", 80, 0), game("kc", "buf", 14, 13)];
assert(rankConference(teams, direct, "AFC").leaders.has("kc"), "Head-to-head takes precedence over point differential");

// Scheduled and live games may not affect postseason ranking.
const next = [...divisionWins, game("kc", "lac", 60, 0, "live")];
assert(rankConference(teams, next, "AFC").leaders.has("den"), "Do not count live games in completed standings");

console.log("NFL tiebreaker regression checks passed.");
