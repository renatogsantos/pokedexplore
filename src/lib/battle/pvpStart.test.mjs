import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const catalogSource = await readFile(new URL("../items/catalog.js", import.meta.url), "utf8");
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString("base64")}`);
globalThis.__pvpKnownEquipment = (item) => {
  const id = catalog.migrateLegacyItemId(typeof item === "string" ? item : item?.id);
  return catalog.getItemDefinition(id)?.usageType === "HELD" ? id : null;
};
const source = (await readFile(new URL("./pvpStart.js", import.meta.url), "utf8"))
  .replace('import { getHeldItemInventoryId } from "@/lib/economy/heldItems";', "const getHeldItemInventoryId = globalThis.__pvpKnownEquipment;");
const { getLogicalPresencePlayers, getPvpStartSnapshot, validatePvpTeam } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const team = (prefix, equipment = {}) => [1, 2, 3].map((id) => ({ id: `${prefix}-${id}`, name: `pokemon-${id}`, level: 1, ...equipment }));
const readyInput = () => ({ channelStatus: "CONNECTED", isHost: true, peerPresent: true, hostReady: true, guestReady: true, hostTeam: team("host"), guestTeam: team("guest") });

test("both ready starts in either READY order once normalized state is complete", () => {
  assert.equal(getPvpStartSnapshot(readyInput()).canStart, true);
  assert.equal(getPvpStartSnapshot({ ...readyInput(), hostReady: false }).blocker, "HOST_NOT_READY");
  assert.equal(getPvpStartSnapshot({ ...readyInput(), guestReady: false }).blocker, "GUEST_NOT_READY");
  assert.equal(getPvpStartSnapshot({ ...readyInput(), peerPresent: false }).blocker, "OPPONENT_NOT_PRESENT");
});

test("PVP accepts optional strategic and relic equipment and legacy heldItem", () => {
  [{}, { strategicItem: "fruit-vital" }, { elementalRelic: "brasa-primordial" }, { strategicItem: "fruit-vital", elementalRelic: "brasa-primordial" }, { heldItem: "fruit-vital" }].forEach((equipment) => assert.equal(validatePvpTeam(team("p", equipment)).valid, true));
});

test("duplicate Presence metas collapse by stable player id and newest update wins", () => {
  const players = getLogicalPresencePlayers({ a: [{ id: "host", ready: false, presenceUpdatedAt: 1 }, { id: "host", ready: true, presenceUpdatedAt: 2 }], b: [{ id: "guest", ready: true, presenceUpdatedAt: 1 }] });
  assert.equal(players.length, 2);
  assert.equal(players.find((player) => player.id === "host").ready, true);
});
