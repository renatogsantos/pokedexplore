import assert from "node:assert/strict";
import test from "node:test";
import {
  BATTLE_ITEM_SOUND,
  BATTLE_EVENT_SOUND,
  appendBattleAudioEvents,
  createBattleAudioEventDeduper,
  getBadgeRoundSound,
  getDamageReactionSound,
  getItemConsumptionSound,
} from "./sound.js";

test("fairy Pokémon use the fairy damage reaction and all other types use normal damage", () => {
  assert.equal(getDamageReactionSound({ type: "fairy" }), "anime-ahh");
  assert.equal(getDamageReactionSound({ types: ["normal", "fairy"] }), "anime-ahh");
  assert.equal(getDamageReactionSound({ type: "fire" }), "dano");
  assert.equal(getDamageReactionSound({ types: [{ type: { name: "water" } }] }), "dano");
});

test("catalog-driven item audio distinguishes confirmed Bag use from consumed Held items", () => {
  const bag = { id: "vital-potion", usageType: "BAG", consumable: true };
  const held = { id: "healing-core", usageType: "HELD", consumable: true };
  const permanent = { id: "elemental-core", usageType: "HELD", consumable: false };

  assert.equal(
    getItemConsumptionSound({ definition: bag, effect: { kind: "item", itemId: "vital-potion", result: { consumed: true } } }),
    BATTLE_ITEM_SOUND.BAG_ITEM_USED,
  );
  assert.equal(
    getItemConsumptionSound({ definition: bag, effect: { kind: "item", itemId: "vital-potion", result: { consumed: false } } }),
    null,
  );
  assert.equal(
    getItemConsumptionSound({ definition: held, event: { type: "ITEM_CONSUMED", consumed: true } }),
    BATTLE_ITEM_SOUND.HELD_ITEM_CONSUMED,
  );
  assert.equal(
    getItemConsumptionSound({ definition: permanent, event: { type: "ITEM_CONSUMED", consumed: true } }),
    null,
  );
});

test("item audio events are idempotent per battle and reset for a rematch", () => {
  const deduper = createBattleAudioEventDeduper();
  assert.equal(deduper.shouldPlay("match-1", "event-7", BATTLE_ITEM_SOUND.BAG_ITEM_USED), true);
  assert.equal(deduper.shouldPlay("match-1", "event-7", BATTLE_ITEM_SOUND.BAG_ITEM_USED), false);
  assert.equal(deduper.shouldPlay("match-2", "event-7", BATTLE_ITEM_SOUND.BAG_ITEM_USED), true);
});

const battleState = ({ host = [], guest = [], status = "playing", winner = null, seriesBattleNumber = null, hostHasSwitched = false, guestHasSwitched = false } = {}) => ({
  matchId: "match-1",
  status,
  winner,
  seriesBattleNumber,
  host: { team: host },
  guest: { team: guest },
  performance: { players: { host: { hasSwitched: hostHasSwitched }, guest: { hasSwitched: guestHasSwitched } } },
});
const pokemon = (hp, maxHp = 100) => ({ hp, maxHp });

test("finish him is emitted only for an alive final Pokemon below 20 percent", () => {
  const prior = battleState({ host: [pokemon(100), pokemon(100), pokemon(100)], guest: [pokemon(0), pokemon(0), pokemon(25)] });
  assert.deepEqual(appendBattleAudioEvents(prior, prior, { mode: "cpu" }), prior);
  const threeAlive = battleState({ host: [pokemon(19), pokemon(1), pokemon(1)] });
  assert.equal(appendBattleAudioEvents(prior, threeAlive).audioEvents, undefined);
  const exactlyTwenty = battleState({ host: [pokemon(0), pokemon(0), pokemon(20)] });
  assert.equal(appendBattleAudioEvents(prior, exactlyTwenty).audioEvents, undefined);
  const critical = battleState({ host: [pokemon(0), pokemon(0), pokemon(19)] });
  const withEvent = appendBattleAudioEvents(prior, critical);
  assert.deepEqual(withEvent.audioEvents, [{ id: "finish-him:host", sound: BATTLE_EVENT_SOUND.FINISH_HIM }]);
  const lowerHp = battleState({ host: [pokemon(0), pokemon(0), pokemon(8)], guest: [pokemon(100)], });
  assert.deepEqual(appendBattleAudioEvents(withEvent, { ...lowerHp, audioEvents: withEvent.audioEvents }).audioEvents, withEvent.audioEvents);
  const fainted = battleState({ host: [pokemon(0), pokemon(0), pokemon(0)], status: "finished", winner: "guest" });
  assert.deepEqual(appendBattleAudioEvents(prior, fainted).audioEvents, [{ id: "battle-result", sound: BATTLE_EVENT_SOUND.BRUTALITY }]);
});

test("result sound uses brutality only for the same no-switch condition that grants the one-Pokemon reward", () => {
  const previous = battleState();
  assert.equal(appendBattleAudioEvents(previous, battleState({ host: [pokemon(100), pokemon(100), pokemon(100)], status: "finished", winner: "host" })).audioEvents[0].sound, BATTLE_EVENT_SOUND.BRUTALITY);
  assert.equal(appendBattleAudioEvents(previous, battleState({ host: [pokemon(0), pokemon(0), pokemon(1)], status: "finished", winner: "host", hostHasSwitched: true })).audioEvents[0].sound, BATTLE_EVENT_SOUND.VICTORY);
});

test("badge round sounds use the authoritative series battle number only", () => {
  assert.equal(getBadgeRoundSound("badge-cpu", 1), BATTLE_EVENT_SOUND.ROUND_ONE);
  assert.equal(getBadgeRoundSound("badge-pvp", 2), BATTLE_EVENT_SOUND.ROUND_TWO);
  assert.equal(getBadgeRoundSound("badge-pvp", 3), BATTLE_EVENT_SOUND.FINAL_ROUND);
  assert.equal(getBadgeRoundSound("cpu", 1), null);
  assert.equal(getBadgeRoundSound("friend", 2), null);
  assert.equal(getBadgeRoundSound("tournament", 3), null);
  const start = appendBattleAudioEvents(battleState({ status: "countdown", seriesBattleNumber: 3 }), battleState({ status: "playing", seriesBattleNumber: 3 }), { mode: "badge-pvp" });
  assert.deepEqual(start.audioEvents, [{ id: "badge-round:3", sound: BATTLE_EVENT_SOUND.FINAL_ROUND }]);
});
