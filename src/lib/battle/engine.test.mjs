import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engineSource = await readFile(new URL("./engine.js", import.meta.url), "utf8");
const { MAX_POTIONS, createBattleState, resolveAction } = await import(`data:text/javascript;base64,${Buffer.from(engineSource).toString("base64")}`);

const pokemon = (id, hp = 100, maxHp = 100) => ({ id, name: `pokemon-${id}`, type: "normal", hp, maxHp });
const makeState = () => createBattleState(
  { id: "host", name: "Host", team: [pokemon(1, 30), pokemon(2, 50), pokemon(3, 0)] },
  { id: "guest", name: "Guest", team: [pokemon(4), pokemon(5), pokemon(6)] },
);

test("every new battle starts each player with two potions", () => {
  const state = makeState();
  assert.equal(state.host.potionsRemaining, MAX_POTIONS);
  assert.equal(state.guest.potionsRemaining, MAX_POTIONS);
});

test("potion heals 40% of max HP, consumes one potion and the turn", () => {
  const next = resolveAction(makeState(), "host", { type: "potion", targetPokemonId: 1 });
  assert.equal(next.host.team[0].hp, 70);
  assert.equal(next.host.potionsRemaining, 1);
  assert.equal(next.turn, "guest");
  assert.deepEqual(next.effect, { kind: "potion", actor: "host", target: "host", targetPokemonId: 1, targetIndex: 0, healing: 40 });
});

test("potion caps healing at max HP and can target a reserve Pokemon", () => {
  const state = makeState();
  state.host.team[1].hp = 85;
  const next = resolveAction(state, "host", { type: "potion", targetPokemonId: 2 });
  assert.equal(next.host.team[1].hp, 100);
  assert.equal(next.effect.healing, 15);
});

test("invalid potion attempts never consume a potion or turn", () => {
  const fullHp = makeState();
  fullHp.host.team[1].hp = fullHp.host.team[1].maxHp;
  assert.strictEqual(resolveAction(fullHp, "host", { type: "potion", targetPokemonId: 2 }), fullHp);
  const fainted = makeState();
  assert.strictEqual(resolveAction(fainted, "host", { type: "potion", targetPokemonId: 3 }), fainted);
  const opponent = makeState();
  assert.strictEqual(resolveAction(opponent, "host", { type: "potion", targetPokemonId: 4 }), opponent);
  const noPotions = makeState();
  noPotions.host.potionsRemaining = 0;
  assert.strictEqual(resolveAction(noPotions, "host", { type: "potion", targetPokemonId: 1 }), noPotions);
  const wrongTurn = makeState();
  assert.strictEqual(resolveAction(wrongTurn, "guest", { type: "potion", targetPokemonId: 4 }), wrongTurn);
});

test("a fresh rematch state resets potions", () => {
  const state = makeState();
  const used = resolveAction(state, "host", { type: "potion", targetPokemonId: 1 });
  const rematch = createBattleState(used.host, used.guest);
  assert.equal(rematch.host.potionsRemaining, MAX_POTIONS);
  assert.equal(rematch.guest.potionsRemaining, MAX_POTIONS);
});
