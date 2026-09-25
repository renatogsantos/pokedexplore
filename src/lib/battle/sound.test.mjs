import assert from "node:assert/strict";
import test from "node:test";
import { getDamageReactionSound } from "./sound.js";

test("fairy Pokémon use the fairy damage reaction and all other types use normal damage", () => {
  assert.equal(getDamageReactionSound({ type: "fairy" }), "anime-ahh");
  assert.equal(getDamageReactionSound({ types: ["normal", "fairy"] }), "anime-ahh");
  assert.equal(getDamageReactionSound({ type: "fire" }), "dano");
  assert.equal(getDamageReactionSound({ types: [{ type: { name: "water" } }] }), "dano");
});
