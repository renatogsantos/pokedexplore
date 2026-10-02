import test from "node:test";
import assert from "node:assert/strict";
import { BADGE_CONFIG } from "../badges/config.js";
import { hasPokemonMasterTitle } from "./pokemonMaster.js";

const owned = () => BADGE_CONFIG.map(({ code }) => ({ code, owner_player_id: "existing-player" }));

test("requires every unique canonical badge currently owned by the existing identity", () => {
  assert.equal(hasPokemonMasterTitle("existing-player", owned()), true);
  assert.equal(hasPokemonMasterTitle("existing-player", owned().slice(1)), false);
  assert.equal(hasPokemonMasterTitle("other-player", owned()), false);
  assert.equal(hasPokemonMasterTitle(null, owned()), false);
});

test("duplicate and unknown records cannot substitute for the missing eighteenth badge", () => {
  const seventeen = owned().slice(1);
  assert.equal(hasPokemonMasterTitle("existing-player", [...seventeen, seventeen[0]]), false);
  assert.equal(hasPokemonMasterTitle("existing-player", [...seventeen, { code: "fake", owner_player_id: "existing-player" }]), false);
});

test("18 to 17 removes the active title and recovery restores it without changing identity", () => {
  const badges = owned();
  assert.equal(hasPokemonMasterTitle("existing-player", badges), true);
  const transferred = badges.map((badge, index) => index ? badge : { ...badge, owner_player_id: "new-owner" });
  assert.equal(hasPokemonMasterTitle("existing-player", transferred), false);
  assert.equal(hasPokemonMasterTitle("existing-player", badges), true);
});

test("invalid ownership input never activates a title", () => {
  for (const input of [undefined, null, {}, [], [null]]) {
    assert.equal(hasPokemonMasterTitle("existing-player", input), false);
  }
});
