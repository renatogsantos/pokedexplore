import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (await readFile(new URL("./rules.js", import.meta.url), "utf8")).replace(
  'import { getPokemonRarity, POKEMON_RARITY } from "@/lib/pokemon/rarity";',
  'const POKEMON_RARITY = { LEGENDARY: "legendary", MYTHICAL: "mythical", NORMAL: "normal" }; const getPokemonRarity = (pokemon) => pokemon?.rarity === "legendary" || pokemon?.isLegendary ? "legendary" : pokemon?.rarity === "mythical" || pokemon?.isMythical ? "mythical" : "normal";',
).replace(
  'import {\n  BADGE_CHAMPION_COIN_MULTIPLIER,\n  BADGE_INACTIVITY_HOURS,\n  BADGE_REQUIRED_WINS,\n  BADGE_TEAM_SIZE,\n} from "./config";',
  'const BADGE_CHAMPION_COIN_MULTIPLIER = 1.25; const BADGE_INACTIVITY_HOURS = 48; const BADGE_REQUIRED_WINS = 4; const BADGE_TEAM_SIZE = 3;',
);
const rules = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const { advanceBadgeSeries, getBadgeChallengeExitAction, getChampionCoinMultiplier, isBadgeOwnerInactive, validateBadgeTeam } = rules;

const pokemon = (name, types, extra = {}) => ({ name, types: types.map((type) => ({ type: { name: type } })), rarity: "normal", ...extra });

test("badge teams require three legal Pokemon and at least one matching type", () => {
  const valid = [pokemon("charizard", ["fire", "flying"]), pokemon("blastoise", ["water"]), pokemon("venusaur", ["grass", "poison"])];
  assert.equal(validateBadgeTeam(valid, "fire").valid, true);
  assert.equal(validateBadgeTeam([pokemon("blastoise", ["water"]), pokemon("venusaur", ["grass"]), pokemon("pikachu", ["electric"])], "fire").errors[0].code, "missing-type");
  assert.equal(validateBadgeTeam([pokemon("alicia", ["fairy"], { source: "custom", rarity: "legendary", isLegendary: true }), ...valid.slice(0, 2)], "fire").errors[0].code, "legendary");
  assert.equal(validateBadgeTeam([pokemon("dratini", ["dragon"]), pokemon("charizard", ["fire", "flying"]), pokemon("squirtle", ["water"])], "dragon").valid, true);
});

test("badge series is a perfect four-win run and ends on the first loss", () => {
  let state = { challengerWins: 0, challengerWon: true };
  for (let wins = 1; wins <= 4; wins += 1) {
    const result = advanceBadgeSeries(state);
    assert.equal(result.challengerWins, wins);
    assert.equal(result.complete, wins === 4);
    state = { challengerWins: result.challengerWins, challengerWon: true };
  }
  assert.equal(advanceBadgeSeries({ challengerWins: 3, challengerWon: false }).status, "DEFENDED");
  assert.equal(advanceBadgeSeries({ challengerWins: 0, challengerWon: false }).complete, true);
});

test("champion multiplier never stacks per badge", () => {
  assert.equal(getChampionCoinMultiplier(0), 1);
  assert.equal(getChampionCoinMultiplier(1), 1.25);
  assert.equal(getChampionCoinMultiplier(3), 1.25);
  assert.equal(getChampionCoinMultiplier(18), 1.25);
});

test("inactivity uses the 48-hour boundary and protects active challenges", () => {
  const now = "2026-09-17T12:00:00.000Z";
  assert.equal(isBadgeOwnerInactive({ lastBattleAt: "2026-09-15T12:00:00.000Z", now }), true);
  assert.equal(isBadgeOwnerInactive({ lastBattleAt: "2026-09-15T12:01:00.000Z", now }), false);
  assert.equal(isBadgeOwnerInactive({ lastBattleAt: "2026-09-14T12:00:00.000Z", now, activeChallenge: true }), false);
});

test("only the challenger can cancel or abandon and PvP consequences start with the official series", () => {
  const base = { challenger_player_id: "challenger", status: "ACTIVE" };
  for (let challengerWins = 0; challengerWins <= 3; challengerWins += 1) {
    assert.equal(getBadgeChallengeExitAction({ ...base, challenge_kind: "INITIAL_CPU", challenger_wins: challengerWins }, "challenger"), "CANCEL");
  }
  assert.equal(getBadgeChallengeExitAction({ ...base, status: "PENDING_ACCEPTANCE", challenge_kind: "PVP_TAKEOVER", series_started_at: null }, "challenger"), "CANCEL");
  assert.equal(getBadgeChallengeExitAction({ ...base, challenge_kind: "PVP_TAKEOVER", accepted_at: "2026-09-17T12:00:00Z", series_started_at: null }, "challenger"), "CANCEL");
  assert.equal(getBadgeChallengeExitAction({ ...base, challenge_kind: "PVP_TAKEOVER", series_started_at: "2026-09-17T12:05:00Z" }, "challenger"), "ABANDON");
  assert.equal(getBadgeChallengeExitAction({ ...base, challenge_kind: "PVP_TAKEOVER", series_started_at: "2026-09-17T12:05:00Z" }, "defender"), null);
  assert.equal(getBadgeChallengeExitAction({ ...base, status: "COMPLETED", challenge_kind: "INITIAL_CPU" }, "challenger"), null);
  assert.equal(getBadgeChallengeExitAction({ ...base, status: "CANCELLED", challenge_kind: "INITIAL_CPU" }, "challenger"), null);
});
