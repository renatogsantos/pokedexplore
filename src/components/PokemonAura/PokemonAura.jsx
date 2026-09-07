import { pokemonData } from "@/helpers/PokemonTypes";
import { getPokemonLevel } from "@/lib/pokemon/progression";
import { isPokemonShiny } from "@/lib/pokemon/sprites";
import styles from "./PokemonAura.module.scss";

const PARTICLES = ["8,-2,4,0", "15,1,5,1", "21,-1,6,2", "27,2,4,3", "32,-2,7,1", "37,1,5,0", "42,-1,6,3", "46,2,4,2", "51,-2,7,0", "56,1,5,1", "61,-1,6,2", "66,2,4,3", "71,-2,7,1", "76,1,5,0", "82,-1,6,3", "12,2,4,2", "24,-2,7,1", "35,1,5,0", "48,-1,6,2", "59,2,4,3", "69,-2,7,1", "79,1,5,0", "88,-1,6,2", "53,2,4,3"];
const typesOf = (pokemon) => (pokemon?.types || [pokemon?.type]).map((entry) => typeof entry === "string" ? entry : entry?.type?.name || entry?.name).filter(Boolean);
const typeColor = (type) => pokemonData.find((entry) => entry.type === type)?.color || "#8bdcff";

export default function PokemonAura({ pokemon, variant = "full", className = "", children }) {
  const level = getPokemonLevel(pokemon);
  if (!isPokemonShiny(pokemon)) return children;
  const types = typesOf(pokemon);
  const intensity = Math.min(1.35, 1 + Math.max(0, level - 6) * .07);
  const count = variant === "thumbnail" ? 0 : variant === "compact" ? 10 : variant === "battle" ? 18 : 22;
  const particles = PARTICLES.slice(0, count);
  const Particle = ({ particle, index, foreground = false }) => { const [x, drift, duration, delay] = particle.split(","); const family = index % 7 === 0 ? "mote" : index % 3 === 0 ? "streak" : "dot"; return <i className={`${styles.particle} ${styles[family]} ${foreground ? styles.foreground : ""}`} style={{ "--x": `${x}%`, "--drift": `${Number(drift) * 14}px`, "--duration": `${Number(duration) * .32 + 1.15}s`, "--delay": `${Number(delay) * -.43}s`, "--size": `${2 + index % 5}px` }} aria-hidden="true" />; };
  return <span className={`${styles.aura} ${styles[variant] || styles.full} ${className}`} style={{ "--aura-primary": typeColor(types[0]), "--aura-secondary": typeColor(types[1] || types[0]), "--aura-intensity": intensity }} aria-label={`Aura despertada, nível ${level}`}>
    <span className={styles.ground} aria-hidden="true" /><span className={styles.wisp} aria-hidden="true" />
    {particles.slice(0, Math.ceil(count * .7)).map((particle, index) => <Particle key={particle} particle={particle} index={index} />)}
    <span className={styles.sprite}>{children}</span>{particles.slice(Math.ceil(count * .7)).map((particle, index) => <Particle key={particle} particle={particle} index={index + Math.ceil(count * .7)} foreground />)}<span className={styles.spark} aria-hidden="true" />
  </span>;
}
