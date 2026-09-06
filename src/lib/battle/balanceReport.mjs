// Dev-only balancing probe. Run `npm run balance:battle`; never imported by the app.
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./engine.js", import.meta.url), "utf8");
const { calculateDamage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const fighter = (name, type, hp, stats, level = 5) => ({ name, type, types: [type], maxHp: hp, hp, level, stats });
const cases = [
  [fighter("Pikachu", "electric", 90, { attack: 55, defense: 40, specialAttack: 60, specialDefense: 50 }), fighter("Squirtle", "water", 110, { attack: 48, defense: 65, specialAttack: 50, specialDefense: 64 }), "Thunderbolt", 90, true],
  [fighter("Squirtle", "water", 110, { attack: 48, defense: 65, specialAttack: 50, specialDefense: 64 }), fighter("Pikachu", "electric", 90, { attack: 55, defense: 40, specialAttack: 60, specialDefense: 50 }), "Water Gun", 60, false],
  [fighter("Charizard", "fire", 120, { attack: 84, defense: 78, specialAttack: 109, specialDefense: 85 }), fighter("Venusaur", "grass", 125, { attack: 82, defense: 83, specialAttack: 100, specialDefense: 100 }), "Flamethrower", 90, true],
  [fighter("Onix", "rock", 100, { attack: 45, defense: 160, specialAttack: 30, specialDefense: 45 }), fighter("Pikachu", "electric", 90, { attack: 55, defense: 40, specialAttack: 60, specialDefense: 50 }), "Rock Slide", 75, false],
];
for (const [attacker, defender, name, power, special] of cases) { const result = calculateDamage({ attacker, defender, move: { name, type: attacker.type, power, damageClass: special ? "special" : "physical", special } }); console.log(`${attacker.name} Lv.${attacker.level} · ${name} → ${defender.name} Lv.${defender.level}: ${result.damage}/${defender.maxHp} (${Math.round(result.percentage * 100)}%) · ${Math.ceil(defender.maxHp / result.damage)} hits · ${result.effectivenessLabel}`); }
