import assert from "node:assert/strict";
import test from "node:test";
import {
  BATTLE_ITEM_SOUND,
  createBattleAudioEventDeduper,
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
