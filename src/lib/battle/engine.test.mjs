import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engineSource = await readFile(new URL("./engine.js", import.meta.url), "utf8");
const { MAX_POTIONS, MAX_SPECIAL_ATTACK_USES, calculateDamage, createBattleState, getHpRatio, getPokemonMatchup, multiplier, resolveAction, resolvePostDamageHeldItem } = await import(`data:text/javascript;base64,${Buffer.from(engineSource).toString("base64")}`);

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

test("special attack has two uses per Pokemon and resets in a new battle", () => {
  const state = makeState();
  const first = resolveAction(state, "host", { type: "attack", moveId: "type-strike" });
  assert.equal(first.host.team[0].specialAttackUsesRemaining, 1);
  const second = resolveAction({ ...first, turn: "host" }, "host", { type: "attack", moveId: "type-strike" });
  assert.equal(second.host.team[0].specialAttackUsesRemaining, 0);
  const exhausted = resolveAction({ ...second, turn: "host" }, "host", { type: "attack", moveId: "type-strike" });
  assert.equal(exhausted.host.team[0].specialAttackUsesRemaining, 0);
  assert.equal(exhausted.guest.team[0].hp, second.guest.team[0].hp);
  assert.equal(createBattleState(second.host, second.guest).host.team[0].specialAttackUsesRemaining, MAX_SPECIAL_ATTACK_USES);
});

test("type helper classifies the same matchup used by battle damage", () => {
  const electric = { type: "electric" }; const water = { types: ["water"] };
  assert.equal(multiplier("electric", water), 1.3);
  assert.equal(getPokemonMatchup(electric, water), "advantage");
  assert.equal(getPokemonMatchup({ type: "fire" }, water), "disadvantage");
});

test("normalized damage preserves decision windows and caps extreme matchups", () => {
  const attacker = { type: "electric", types: ["electric"], level: 5, maxHp: 100, hp: 100, stats: { attack: 55, defense: 45, specialAttack: 60, specialDefense: 50, speed: 80 } };
  const defender = { type: "water", types: ["water"], level: 5, maxHp: 110, hp: 110, stats: { attack: 50, defense: 60, specialAttack: 55, specialDefense: 60, speed: 45 } };
  const standard = calculateDamage({ attacker, defender, move: { type: "electric", power: 60, damageClass: "physical", special: false } });
  const special = calculateDamage({ attacker, defender, move: { type: "electric", power: 90, damageClass: "special", special: true } });
  assert.ok(standard.damage / defender.maxHp >= .22 && standard.damage / defender.maxHp <= .35);
  assert.ok(special.damage / defender.maxHp >= .30 && special.damage / defender.maxHp <= .45);
});

test("successful and forced switches permanently invalidate the one-Pokémon challenge", () => {
  const switched = resolveAction(makeState(), "host", { type: "switch", index: 1 });
  assert.equal(switched.performance.players.host.hasSwitched, true);
  const forced = makeState();
  forced.guest.team[0].hp = 1;
  const resolved = resolveAction(forced, "host", { type: "attack", moveId: "strike" });
  assert.equal(resolved.guest.active, 1);
  assert.equal(resolved.performance.players.guest.hasSwitched, true);
});

test("battle bag Full Heal consumes the turn and clears a supported status", () => {
  const state = makeState();
  state.host.team[0].status = { id: "burn", turns: 0 };
  const next = resolveAction(state, "host", { type: "item", itemId: "full-heal", targetPokemonId: 1 });
  assert.equal(next.host.team[0].status, null);
  assert.equal(next.host.bag["full-heal"], 0);
  assert.equal(next.turn, "guest");
});

test("berries activate automatically once at their configured HP threshold", () => {
  const state = makeState();
  state.guest.team[0].heldItem = "oran";
  state.guest.team[0].hp = 55;
  const next = resolveAction(state, "host", { type: "attack", moveId: "strike" });
  assert.equal(next.guest.team[0].heldItem, null);
  assert.ok(next.effect.berry?.healing > 0);
  assert.equal(next.effect.berry?.owner, "guest");
  assert.equal(next.effect.berry?.targetPokemonId, 4);
});

test("post-damage berries use the normalized current HP threshold and never revive", () => {
  const fighter = (hp, heldItem = "oran") => ({ id: 1, hp, maxHp: 100, heldItem });
  assert.equal(getHpRatio(80, 100), .8);
  assert.equal(resolvePostDamageHeldItem(fighter(80)), null);
  assert.equal(resolvePostDamageHeldItem(fighter(51)), null);
  const atBoundary = fighter(50);
  assert.deepEqual(resolvePostDamageHeldItem(atBoundary), { berry: "oran", trigger: "post-attack-damage", healing: 20, beforeHp: 50, afterHp: 70, consumed: true });
  assert.equal(atBoundary.heldItem, null);
  const fainted = fighter(0);
  assert.equal(resolvePostDamageHeldItem(fainted), null);
  assert.equal(fainted.heldItem, "oran");
});

test("Sitrus heals 30% of max HP only at the same post-damage threshold", () => {
  const highHp = { id: 1, hp: 51, maxHp: 100, heldItem: "sitrus" };
  assert.equal(resolvePostDamageHeldItem(highHp), null);
  const triggered = { id: 1, hp: 40, maxHp: 100, heldItem: "sitrus" };
  assert.equal(resolvePostDamageHeldItem(triggered).healing, 30);
  assert.equal(triggered.hp, 70);
  assert.equal(triggered.heldItem, null);
});

test("type amplifier applies exactly once to a matching primary-type move", () => {
  const attacker = { ...pokemon(1), type: "electric", types: ["electric"], stats: { attack: 50, defense: 50, specialAttack: 50, specialDefense: 50 }, heldItem: "electric-boost" };
  const defender = { ...pokemon(2), type: "water", types: ["water"], stats: { attack: 50, defense: 50, specialAttack: 50, specialDefense: 50 } };
  const boosted = calculateDamage({ attacker, defender, move: { type: "electric", power: 40, damageClass: "physical" }, variance: 1 });
  const otherType = calculateDamage({ attacker, defender, move: { type: "normal", power: 40, damageClass: "physical" }, variance: 1 });
  assert.equal(boosted.heldItemBonus?.multiplier, 1.1);
  assert.equal(otherType.heldItemBonus, null);
});

test("supported low-HP abilities are resolved by the engine", () => {
  const boosted = makeState();
  boosted.host.team[0] = { ...boosted.host.team[0], type: "fire", types: ["fire"], ability: "blaze", hp: 20, moves: [{ id: "fire-special", name: "Flamethrower", type: "fire", power: 90, accuracy: 100, damageClass: "special", special: true }] };
  const normal = structuredClone(boosted);
  normal.host.team[0].ability = null;
  const withBlaze = resolveAction(boosted, "host", { type: "attack", moveId: "fire-special" });
  const withoutBlaze = resolveAction(normal, "host", { type: "attack", moveId: "fire-special" });
  assert.ok(withBlaze.effect.damage > withoutBlaze.effect.damage);
  assert.equal(withBlaze.effect.ability, "blaze");
});

test("a persisted four-move build replaces the default battle moves", () => {
  const state = createBattleState(
    { id: "host", name: "Host", team: [{ ...pokemon(1), moveset: [{ id: "one", name: "One", type: "normal", power: 40 }, { id: "two", name: "Two", type: "normal", power: 50 }, { id: "three", name: "Three", type: "normal", power: 60 }, { id: "tm", name: "TM", type: "electric", power: 90, damageClass: "special", special: true }] }] },
    { id: "guest", name: "Guest", team: [pokemon(2), pokemon(3), pokemon(4)] },
  );
  assert.equal(state.host.team[0].moves.length, 4);
  assert.equal(state.host.team[0].moves[3].id, "tm");
});
