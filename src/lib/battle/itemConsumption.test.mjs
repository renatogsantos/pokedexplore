import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./itemConsumption.js", import.meta.url), "utf8");
const { getItemConsumptionEvents } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("only authoritative consumptions owned by this player are settled", () => {
  const state = {
    matchId: "match-1",
    revision: 8,
    host: { id: "host-player" },
    guest: { id: "guest-player" },
    effect: {
      kind: "attack",
      itemEvents: [
        { itemId: "healing-core", pokemonId: 25, owner: "guest", consumed: true, eventId: "core-1" },
        { itemId: "elemental-core", pokemonId: 25, owner: "guest", consumed: false, eventId: "elemental-1" },
      ],
    },
  };
  assert.deepEqual(getItemConsumptionEvents(state, "host"), []);
  assert.deepEqual(getItemConsumptionEvents(state, "guest"), [{
    type: "ITEM_CONSUMED", usageType: "HELD", ownerRole: "guest", ownerPlayerId: "guest-player",
    itemId: "healing-core", pokemonInstanceId: 25, eventId: "core-1",
    consumptionId: "match-1:held:guest:25:healing-core:core-1",
  }]);
});

test("bag consumption is settled only after a valid engine result", () => {
  const state = { matchId: "match-2", revision: 3, host: { id: "host-player" }, effect: { kind: "item", actor: "host", itemId: "vital-potion", eventId: "potion-1", result: { consumed: true } } };
  assert.equal(getItemConsumptionEvents(state, "host")[0].usageType, "BAG");
  state.effect.result.consumed = false;
  assert.deepEqual(getItemConsumptionEvents(state, "host"), []);
});
