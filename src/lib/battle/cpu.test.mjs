import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let source = await readFile(new URL("./cpu.js", import.meta.url), "utf8");
source = source
  .replace(/import \{[\s\S]*?\} from "@\/lib\/battle\/engine";/, `
    const getTypeEffectiveness = (attackType, defender) => attackType === defender.type ? 1 : attackType === "water" && defender.type === "fire" ? 2 : attackType === "grass" && defender.type === "water" ? 2 : attackType === "fire" && defender.type === "grass" ? 2 : .5;
    const calculateDamage = ({ attacker, defender, move }) => Math.round((move.power || 40) * getTypeEffectiveness(move.type === "own" ? attacker.type : move.type, defender));
    const analyzeMoveDecision = () => ({ blockedByAbility: false, contactRisk: null });
    const getHpRatio = (hp, maxHp) => hp / maxHp;
    const getPotionHealAmount = (pokemon) => Math.min(Math.ceil(pokemon.maxHp * .4), pokemon.maxHp - pokemon.hp);
    const getBagItemUseBlockReason = () => null;
  `)
  .replace('import { CPU_ROSTER } from "@/lib/battle/pokemon";', `
    const CPU_ROSTER = [
      [1,"leaf","grass"], [2,"flame","fire"], [3,"wave","water"], [4,"spark","electric"], [5,"rock","rock"], [6,"mind","psychic"]
    ].map(([id, name, type]) => ({ id, name, type, types: [type], evolutionStage: "basic", baseStats: { hp: 70 + id, attack: 50 + id, defense: 45 + id, specialAttack: 48 + id, specialDefense: 45 + id, speed: 40 + id } })).concat([
      { id: 20, name: "evolved", type: "steel", types: ["steel"], cpuTier: "evolved", evolutionStage: "final", baseStats: { hp: 80, attack: 90, defense: 85, specialAttack: 95, specialDefense: 80, speed: 70 } },
      { id: 21, name: "powerful", type: "dragon", types: ["dragon"], cpuTier: "powerful", evolutionStage: "final", baseStats: { hp: 90, attack: 110, defense: 90, specialAttack: 110, specialDefense: 80, speed: 60 } },
      { id: 22, name: "legend", type: "psychic", types: ["psychic"], cpuTier: "legendary", rarity: "legendary", isLegendary: true, baseStats: { hp: 105, attack: 110, defense: 90, specialAttack: 145, specialDefense: 90, speed: 125 } },
      { id: 23, name: "myth", type: "dark", types: ["dark"], cpuTier: "mythical", rarity: "mythical", isMythical: true, baseStats: { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 } }
    ]);
  `)
  .replace('import { BAG_ITEM_CATALOG, ITEM_CATALOG } from "@/lib/items/catalog";', `
    const BAG_ITEM_CATALOG = [];
    const ITEM_CATALOG = [
      { id: "common", rarity: "COMMON" }, { id: "rare", rarity: "RARE" }, { id: "epic", rarity: "EPIC" }, { id: "legendary", rarity: "LEGENDARY" }
    ];
  `);
const cpu = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("CPU difficulty rewards and level offsets are centralized", () => {
  assert.equal(cpu.getCpuDifficulty("easy").baseCoins, 15);
  assert.equal(cpu.getCpuDifficulty("normal").baseCoins, 30);
  assert.equal(cpu.getCpuDifficulty("hard").baseCoins, 60);
  const team = cpu.generateCpuTeam({ difficulty: "hard", playerTeam: [{ level: 4 }, { level: 4 }, { level: 4 }], random: () => .41 });
  assert.equal(team.length, 3);
  assert.ok(team.every((pokemon) => pokemon.level >= 4 && pokemon.level <= 6));
  assert.equal(new Set(team.map((pokemon) => pokemon.type)).size, 3);
});

test("hard CPU spends a legal super-effective special to finish", () => {
  const state = {
    guest: { active: 0, bag: {}, team: [{ id: 1, type: "water", hp: 80, maxHp: 80, specialAttackUsesRemaining: 1, moves: [{ id: "special", type: "water", power: 90, special: true }] }] },
    host: { active: 0, team: [{ id: 2, type: "fire", hp: 120, maxHp: 120 }] },
  };
  assert.deepEqual(cpu.decideCpuIntent(state, { difficulty: "hard", random: () => .99 }), { type: "attack", moveId: "special" });
});

test("legendary is only available after hard's item-drop roll", () => {
  assert.equal(cpu.rollCpuItemDrop("easy", () => .99), null);
  assert.equal(cpu.rollCpuItemDrop("hard", (() => { const values = [.01, .01, .01]; return () => values.shift() ?? .01; })()).id, "legendary");
});

test("difficulty pools keep power ordered and rare encounters controlled", () => {
  let seed = 19;
  const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const metrics = Object.fromEntries(["easy", "medium", "hard"].map((difficulty) => [difficulty, { power: 0, legendary: 0, mythical: 0, teams: new Set() }]));
  for (let index = 0; index < 600; index += 1) {
    for (const difficulty of Object.keys(metrics)) {
      const team = cpu.generateCpuTeam({ difficulty, playerTeam: [{ level: 7 }, { level: 7 }, { level: 7 }], random });
      const metric = metrics[difficulty];
      metric.power += cpu.getCpuTeamPower(team);
      metric.legendary += team.filter((pokemon) => pokemon.isLegendary).length;
      metric.mythical += team.filter((pokemon) => pokemon.isMythical).length;
      metric.teams.add(team.map((pokemon) => pokemon.id).sort().join("-"));
    }
  }
  assert.ok(metrics.easy.power < metrics.medium.power && metrics.medium.power < metrics.hard.power);
  assert.equal(metrics.easy.legendary + metrics.easy.mythical, 0);
  assert.equal(metrics.medium.legendary + metrics.medium.mythical, 0);
  assert.ok(metrics.hard.legendary + metrics.hard.mythical > 0);
  assert.ok(metrics.hard.legendary + metrics.hard.mythical < 620);
  assert.ok(metrics.easy.teams.size + metrics.medium.teams.size + metrics.hard.teams.size > 3);
});
