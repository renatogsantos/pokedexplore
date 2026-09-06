"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CaretRight,
  Coins,
  FirstAid,
  GameController,
  Heart,
  Lightning,
  Shield,
  ShoppingCart,
  Sparkle,
  Sword,
  Trophy,
} from "@phosphor-icons/react";
import {
  MAX_POTIONS,
  MAX_SPECIAL_ATTACK_USES,
  MOVES,
  POTION_HEAL_PERCENTAGE,
} from "@/lib/battle/engine";
import {
  MAX_POKEMON_LEVEL,
  STAT_BONUS_PER_LEVEL,
  calculateLeveledStat,
} from "@/lib/pokemon/progression";
import { COINS_PER_WIN } from "@/lib/economy";

const percent = Math.round(POTION_HEAL_PERCENTAGE * 100);
const levelBonus = Math.round(STAT_BONUS_PER_LEVEL * 100);
const demoDamage =
  MOVES.find((move) => move.id === "type-strike")?.power * 1.5 || 35;

function Pokeball({ size = 24 }) {
  return (
    <img
      className="tutorial-pokeball-icon"
      src="/pokeball.png"
      width={size}
      height={size}
      alt=""
    />
  );
}
function Type({ name }) {
  return (
    <span className={`tutorial-type type-${name}`}>
      <img src={`/types/${name}.svg`} alt="" />
      {name}
    </span>
  );
}
function Pokemon({ name, type, level = 1 }) {
  return (
    <div className="tutorial-pokemon">
      <img src={`/pokemons/${name}.png`} alt={name} />
      <strong>{name}</strong>
      <span>Lv. {level}</span>
      <Type name={type} />
    </div>
  );
}
function Hp({ value, max = 100, label = "HP" }) {
  const safeValue = Math.max(0, value);
  return (
    <div
      className="tutorial-hp"
      aria-label={`${label}: ${safeValue} de ${max}`}
    >
      <div>
        <span>{label}</span>
        <strong>
          {safeValue} / {max}
        </strong>
      </div>
      <span
        className={`tutorial-hp-track ${safeValue / max <= 0.35 ? "danger" : ""}`}
      >
        <i style={{ width: `${(safeValue / max) * 100}%` }} />
      </span>
    </div>
  );
}
function Step({ number, eyebrow, title, children, className = "" }) {
  return (
    <section className={`tutorial-step ${className}`}>
      <div className="tutorial-step-heading">
        <span className="tutorial-step-number">{number}</span>
        <div>
          <span className="tutorial-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function AttackDemo() {
  const [used, setUsed] = useState(false);
  const hp = used ? 100 - demoDamage : 100;
  return (
    <div className="tutorial-duel-demo">
      <Pokemon name="pikachu" type="electric" level={3} />
      <div className="tutorial-duel-action">
        <button
          type="button"
          className="tutorial-attack-button"
          onClick={() => setUsed(true)}
          aria-describedby="attack-demo-result"
        >
          <Lightning size={22} weight="fill" aria-hidden="true" />
          <span>
            <strong>Golpe elétrico</strong>
            <small>{used ? "Usado!" : "Testar ataque"}</small>
          </span>
        </button>
        <span className="tutorial-arrow">
          <ArrowRight aria-hidden="true" />
        </span>
      </div>
      <div className={`tutorial-target ${used ? "is-hit" : ""}`}>
        <Pokemon name="squirtle" type="water" level={2} />
        <Hp value={hp} />
        <strong id="attack-demo-result" className={used ? "is-visible" : ""}>
          {used ? `SUPER EFETIVO! -${demoDamage} HP` : "Escolha o ataque"}
        </strong>
      </div>
    </div>
  );
}

function MatchupDemo() {
  const [choice, setChoice] = useState("pikachu");
  const isGood = choice === "pikachu";
  return (
    <div className="tutorial-matchup-demo">
      <div className="tutorial-opponent">
        <span>ADVERSÁRIO</span>
        <Pokemon name="squirtle" type="water" />
      </div>
      <div className="tutorial-choice-copy">
        <strong>Quem entra?</strong>
        <span>O verde é uma sugestão, mas a escolha é sua.</span>
      </div>
      <div className="tutorial-choice-list">
        <button
          type="button"
          className={`tutorial-choice ${choice === "charizard" ? "selected" : ""} disadvantage`}
          onClick={() => setChoice("charizard")}
        >
          <img src="/pokemons/charizard.png" alt="" />
          <span>
            Charizard<small>Desvantagem</small>
          </span>
        </button>
        <button
          type="button"
          className={`tutorial-choice ${choice === "pikachu" ? "selected" : ""} advantage`}
          onClick={() => setChoice("pikachu")}
        >
          <img src="/pokemons/pikachu.png" alt="" />
          <span>
            Pikachu<small>Vantagem</small>
          </span>
        </button>
      </div>
      <p role="status">
        {isGood
          ? "Boa escolha! Pikachu tem vantagem contra Água."
          : "Charizard pode lutar, mas Pikachu é uma opção melhor."}
      </p>
    </div>
  );
}

export default function Tutorial() {
  const levelOneHp = 100;
  const levelTwoHp = calculateLeveledStat(levelOneHp, 2);
  return (
    <main className="tutorial-page">
      <a className="tutorial-skip" href="#tutorial-content">
        Pular para o tutorial
      </a>
      <header className="tutorial-header">
        <Link href="/" className="tutorial-back">
          <ArrowLeft size={20} aria-hidden="true" /> Pokédex
        </Link>
        <Link href="/batalha" className="tutorial-header-cta">
          <GameController size={19} aria-hidden="true" /> Batalhar
        </Link>
      </header>
      <div className="tutorial-shell" id="tutorial-content">
        <section className="tutorial-hero" aria-labelledby="tutorial-title">
          <div className="tutorial-hero-copy">
            <span className="tutorial-eyebrow">GUIA DO TREINADOR</span>
            <h1 id="tutorial-title">Como jogar</h1>
            <p>
              Monte seu time. Entenda os tipos. Escolha suas ações. Vença a
              batalha!
            </p>
            <div className="tutorial-hero-actions">
              <a href="#capturar" className="tutorial-primary">
                Começar a aprender{" "}
                <CaretRight weight="bold" aria-hidden="true" />
              </a>
              <Link href="/batalha" className="tutorial-secondary">
                Treinar contra CPU
              </Link>
            </div>
          </div>
          <div
            className="tutorial-hero-battle"
            aria-label="Pikachu e Squirtle prontos para batalhar"
          >
            <img src="/pokemons/pikachu.png" alt="Pikachu" />
            <span>VS</span>
            <img src="/pokemons/squirtle.png" alt="Squirtle" />
          </div>
        </section>
        <nav className="tutorial-progress" aria-label="Etapas do tutorial">
          <a href="#capturar">1. Capturar</a>
          <a href="#fortalecer">2. Fortalecer</a>
          <a href="#time">3. Montar time</a>
          <a href="#batalhar">4. Batalhar</a>
          <a href="#vencer">5. Vencer</a>
          <a href="#moedas-e-loja">6. Moedas e Loja</a>
        </nav>
        <div className="tutorial-steps">
          <Step
            number="1"
            eyebrow="COMECE SUA COLEÇÃO"
            title="Capture Pokémon"
            className="capture-step"
          >
            <p>
              Abra Pokébolas para encontrar novos Pokémon. Cada captura fica
              guardada na sua Pokédex.
            </p>
            <div className="tutorial-flow" id="capturar">
              <div>
                <Pokeball size={42} weight="fill" aria-hidden="true" />
                <strong>Abra a Pokébola</strong>
              </div>
              <ArrowRight aria-hidden="true" />
              <div>
                <img src="/pokemons/pikachu.png" alt="Pikachu encontrado" />
                <strong>Um Pokémon aparece</strong>
              </div>
              <ArrowRight aria-hidden="true" />
              <div>
                <img src="/pokedex.png" alt="Pokédex" />
                <strong>Ele entra na Pokédex</strong>
              </div>
            </div>
          </Step>
          <Step
            number="2"
            eyebrow="REPETIDO É BOM"
            title="Duplas deixam seu Pokémon mais forte"
            className="level-step"
          >
            <div id="fortalecer" className="tutorial-level-grid">
              <div>
                <Pokemon name="pikachu" type="electric" level={1} />
                <p>Encontrou outro Pikachu?</p>
              </div>
              <div className="tutorial-level-up">
                <Sparkle size={28} weight="fill" aria-hidden="true" />
                <strong>LEVEL UP!</strong>
                <span>
                  Lv. 1 <ArrowRight aria-hidden="true" /> Lv. 2
                </span>
                <small>+{levelBonus}% nos atributos</small>
              </div>
              <div className="tutorial-level-ladder">
                <span>Lv. 1</span>
                <span>
                  Lv. 2 <b>+{levelBonus}%</b>
                </span>
                <span>
                  Lv. 3 <b>+{levelBonus * 2}%</b>
                </span>
                <span>...</span>
                <span>
                  Lv. {MAX_POKEMON_LEVEL}{" "}
                  <b>+{levelBonus * (MAX_POKEMON_LEVEL - 1)}%</b>
                </span>
              </div>
            </div>
            <p className="tutorial-note">
              Cada Pokémon repetido sobe 1 nível, até o nível{" "}
              {MAX_POKEMON_LEVEL}. Encontrar outro igual deixa o seu mais forte.
            </p>
          </Step>
          <Step
            number="3"
            eyebrow="SUA EQUIPE"
            title="Escolha 3 Pokémon para a batalha"
          >
            <p id="time">
              Antes de lutar, selecione 3 Pokémon da sua Pokédex. Eles serão sua
              equipe e você pode trocar entre eles durante a partida.
            </p>
            <div className="tutorial-team">
              <Pokemon name="pikachu" type="electric" level={4} />
              <Pokemon name="charizard" type="fire" level={2} />
              <Pokemon name="ivysaur" type="grass" level={3} />
            </div>
          </Step>
          <Step number="4" eyebrow="VIDA DO POKÉMON" title="Entenda o HP">
            <div className="tutorial-hp-explainer">
              <Pokemon name="pikachu" type="electric" level={4} />
              <div>
                <Hp value={100} />
                <span className="tutorial-change">
                  Recebeu um ataque: <b>-25</b>
                </span>
                <Hp value={75} />
                <p>
                  HP é a vida do seu Pokémon. Quando chega a 0, ele desmaia e
                  não pode mais lutar.
                </p>
              </div>
              <div className="tutorial-hp-level">
                <span>Lv. 1</span>
                <strong>{levelOneHp} HP</strong>
                <ArrowRight aria-hidden="true" />
                <span>Lv. 2</span>
                <strong>{levelTwoHp} HP</strong>
                <small>Subir de nível deixa o Pokémon mais resistente.</small>
              </div>
            </div>
          </Step>
          <Step
            number="5"
            eyebrow="ATAQUE PARA CAUSAR DANO"
            title="Cada golpe reduz o HP adversário"
            className="attack-step"
          >
            <p id="batalhar">
              O dano depende do golpe, da força do Pokémon e do tipo do ataque.
              Você não precisa fazer contas: a batalha mostra o resultado.
            </p>
            <AttackDemo />
          </Step>
          <Step
            number="6"
            eyebrow="DUAS ESCOLHAS"
            title="Ataque normal ou especial?"
          >
            <div className="tutorial-move-grid">
              <div className="tutorial-move-card">
                <Sword size={31} weight="fill" aria-hidden="true" />
                <strong>Investida</strong>
                <span>Ataque normal</span>
                <b>Sem limite</b>
                <p>É seu ataque simples. Use quantas vezes quiser.</p>
              </div>
              <div className="tutorial-move-card special">
                <Lightning size={31} weight="fill" aria-hidden="true" />
                <strong>Golpe de tipo</strong>
                <span>Ataque especial</span>
                <b>{MAX_SPECIAL_ATTACK_USES} usos por Pokémon</b>
                <div
                  className="tutorial-use-dots"
                  aria-label={`${MAX_SPECIAL_ATTACK_USES} usos disponíveis`}
                >
                  <i />
                  <i />
                </div>
                <p>É mais forte. Guarde para a hora certa.</p>
              </div>
            </div>
          </Step>
          <Step
            number="7"
            eyebrow="PENSE NOS TIPOS"
            title="Alguns golpes são mais fortes"
          >
            <p>
              Quando o tipo do golpe é bom contra o tipo do adversário, ele
              causa mais dano. Quando não é uma boa combinação, causa menos.
            </p>
            <div className="tutorial-type-chain">
              <Type name="fire" />
              <ArrowRight aria-hidden="true" />
              <Type name="grass" />
              <Type name="grass" />
              <ArrowRight aria-hidden="true" />
              <Type name="water" />
              <Type name="electric" />
              <ArrowRight aria-hidden="true" />
              <Type name="water" />
            </div>
            <div className="tutorial-feedback">
              <span className="strong">
                SUPER EFETIVO! <small>Mais dano</small>
              </span>
              <span className="weak">
                DESVANTAGEM <small>Menos dano</small>
              </span>
              <span className="neutral">
                SEM EFEITO <small>Alguns tipos não acertam outros</small>
              </span>
            </div>
          </Step>
          <Step
            number="8"
            eyebrow="O JOGO TE AJUDA"
            title="Veja as fraquezas e os destaques verdes"
          >
            <div className="tutorial-help-grid">
              <div className="tutorial-weakness">
                <Pokemon name="squirtle" type="water" />
                <strong>FRACO CONTRA</strong>
                <div>
                  <Type name="grass" />
                  <Type name="electric" />
                </div>
                <p>As fraquezas do adversário aparecem na arena.</p>
              </div>
              <MatchupDemo />
            </div>
          </Step>
          <Step
            number="9"
            eyebrow="MUDE A ESTRATÉGIA"
            title="Trocar também usa seu turno"
          >
            <div className="tutorial-switch">
              <div>
                <span>ATIVO</span>
                <Pokemon name="charizard" type="fire" />
                <b>Desvantagem</b>
              </div>
              <div className="tutorial-switch-action">
                <button type="button" disabled>
                  <ArrowRight size={26} aria-hidden="true" /> Trocar
                </button>
                <small>O adversário joga depois</small>
              </div>
              <div>
                <span>RESERVA</span>
                <Pokemon name="pikachu" type="electric" />
                <b>Vantagem</b>
              </div>
            </div>
            <p className="tutorial-note">
              Você só pode trocar para um Pokémon que ainda tenha HP.
            </p>
          </Step>
          <Step
            number="10"
            eyebrow="RECUPERE SUA EQUIPE"
            title={`Você começa com ${MAX_POTIONS} poções`}
          >
            <div className="tutorial-potion">
              <Pokemon name="pikachu" type="electric" />
              <div>
                <Hp value={30} />
                <button type="button" disabled>
                  <FirstAid size={23} weight="fill" aria-hidden="true" /> Usar
                  poção
                </button>
                <strong>+{percent} HP</strong>
                <Hp value={Math.min(100, 30 + percent)} />
              </div>
              <p>
                Uma poção recupera até {percent}% do HP máximo e também consome
                seu turno. Ela não revive Pokémon desmaiado nem funciona em HP
                cheio.
              </p>
            </div>
          </Step>
          <Step
            number="11"
            eyebrow="UMA AÇÃO POR VEZ"
            title="Quando é sua vez, escolha uma ação"
          >
            <div className="tutorial-turn">
              <div className="your-turn">
                <Lightning size={25} weight="fill" aria-hidden="true" />
                <strong>SUA VEZ!</strong>
                <span>Ataque, use poção ou troque.</span>
              </div>
              <ArrowRight aria-hidden="true" />
              <div className="waiting-turn">
                <Shield size={25} weight="fill" aria-hidden="true" />
                <strong>VEZ DO ADVERSÁRIO</strong>
                <span>Aguarde a resposta.</span>
              </div>
            </div>
          </Step>
          <Step
            number="12"
            eyebrow="O OBJETIVO"
            title="Derrube os 3 Pokémon adversários"
            className="win-step"
          >
            <div id="vencer" className="tutorial-win-board">
              <div>
                <span>SUA EQUIPE</span>
                <p>
                  <Heart weight="fill" /> Pikachu
                </p>
                <p>
                  <Heart weight="fill" /> Charizard
                </p>
                <p>
                  <Heart weight="fill" /> Ivysaur
                </p>
              </div>
              <Trophy size={48} weight="fill" aria-hidden="true" />
              <div>
                <span>ADVERSÁRIO</span>
                <p className="fainted">✕ Squirtle</p>
                <p className="fainted">✕ Bulbasaur</p>
                <p className="fainted">✕ Eevee</p>
              </div>
            </div>
            <p>Quando os 3 Pokémon do outro time desmaiam, você vence!</p>
          </Step>
        </div>
        <section className="tutorial-coins" aria-labelledby="tutorial-coins-title">
          <div><span className="tutorial-eyebrow">GANHE E ESCOLHA</span><h2 id="tutorial-coins-title">Vitórias rendem novas escolhas</h2><p>Cada vitória vale {COINS_PER_WIN} moedas. Guarde-as para comprar um novo parceiro ou fortalecer um Pokémon que você já adora.</p></div>
          <div className="tutorial-coins-flow"><Trophy weight="fill" aria-hidden="true" /><ArrowRight aria-hidden="true" /><strong>+{COINS_PER_WIN} <Coins weight="fill" aria-hidden="true" /></strong><ArrowRight aria-hidden="true" /><Link href="/loja">Loja Pokémon</Link></div>
        </section>
        <section className="tutorial-shop-guide" id="moedas-e-loja" aria-labelledby="tutorial-shop-title">
          <div className="tutorial-shop-guide__heading">
            <span className="tutorial-eyebrow">ECONOMIA E EVOLUÇÃO</span>
            <h2 id="tutorial-shop-title">Use moedas para completar e fortalecer sua equipe.</h2>
            <p>O saldo fica salvo no jogo. Ganhe batalhas, escolha um Pokémon na Loja e compre mais cópias quando quiser subir o nível dele.</p>
          </div>
          <ol className="tutorial-shop-guide__flow">
            <li>
              <span>1</span>
              <Trophy weight="fill" aria-hidden="true" />
              <strong>Vença uma batalha</strong>
              <small>Receba {COINS_PER_WIN} moedas por vitória.</small>
            </li>
            <li>
              <span>2</span>
              <ShoppingCart weight="fill" aria-hidden="true" />
              <strong>Abra a Loja</strong>
              <small>Busque, filtre e compare os Pokémon pelo preço.</small>
            </li>
            <li>
              <span>3</span>
              <Sparkle weight="fill" aria-hidden="true" />
              <strong>Compre uma cópia</strong>
              <small>Novo Pokémon entra no nível 1; uma cópia repetida aumenta 1 nível.</small>
            </li>
          </ol>
          <div className="tutorial-shop-guide__rules">
            <div><Coins weight="fill" aria-hidden="true" /><p><strong>Preço</strong> varia conforme força e raridade. Lendários e míticos exigem mais moedas.</p></div>
            <div><Sparkle weight="fill" aria-hidden="true" /><p><strong>Evolução de nível</strong> vai até Lv. {MAX_POKEMON_LEVEL}. Cada nível adiciona {levelBonus}% aos atributos; no Lv. {MAX_POKEMON_LEVEL}, o bônus total é de {levelBonus * (MAX_POKEMON_LEVEL - 1)}%.</p></div>
          </div>
          <div className="tutorial-shop-guide__actions">
            <Link href="/loja" className="tutorial-primary"><ShoppingCart weight="fill" aria-hidden="true" /> Ir para a Loja</Link>
            <Link href="/pokedex" className="tutorial-secondary">Ver minha Pokédex</Link>
          </div>
        </section>
        <section className="tutorial-play-modes">
          <div>
            <span className="tutorial-eyebrow">NOVO POR AQUI?</span>
            <h2>Treine primeiro contra a CPU</h2>
            <p>Escolha sua equipe e aprenda no seu ritmo.</p>
            <Link href="/batalha" className="tutorial-primary">
              Treinar agora <GameController aria-hidden="true" />
            </Link>
          </div>
          <div>
            <span className="tutorial-eyebrow">CONTRA UM AMIGO</span>
            <h2>Crie uma sala e compartilhe o código</h2>
            <ol>
              <li>Crie ou entre em uma sala.</li>
              <li>Os dois escolhem 3 Pokémon.</li>
              <li>Fiquem prontos e comecem a batalha.</li>
            </ol>
          </div>
        </section>
        <section className="tutorial-quick-guide">
          <span className="tutorial-eyebrow">PARA LEMBRAR</span>
          <h2>Seu guia rápido de treinador</h2>
          <ul>
            <li>
              <Pokeball aria-hidden="true" /> Capture Pokémon para sua Pokédex.
            </li>
            <li>
              <Sparkle aria-hidden="true" /> Repetidos aumentam o nível.
            </li>
            <li>
              <Heart aria-hidden="true" /> Proteja o HP da equipe.
            </li>
            <li>
              <Sword aria-hidden="true" /> Investida não acaba.
            </li>
            <li>
              <Lightning aria-hidden="true" /> Especial:{" "}
              {MAX_SPECIAL_ATTACK_USES} usos por Pokémon.
            </li>
            <li>
              <FirstAid aria-hidden="true" /> Você tem {MAX_POTIONS} poções.
            </li>
            <li>
              <Sparkle aria-hidden="true" /> “Vantagem” indica uma boa escolha.
            </li>
            <li>
              <Trophy aria-hidden="true" /> Derrube os 3 adversários para
              vencer.
            </li>
            <li>
              <Coins aria-hidden="true" /> Cada vitória rende {COINS_PER_WIN} moedas.
            </li>
            <li>
              <ShoppingCart aria-hidden="true" /> Compre cópias na Loja para subir de nível.
            </li>
          </ul>
        </section>
        <section className="tutorial-final-cta">
          <Pokeball size={42} weight="fill" aria-hidden="true" />
          <span className="tutorial-eyebrow">PRONTO PARA JOGAR?</span>
          <h2>Sua jornada começa agora.</h2>
          <div>
            <Link href="/" className="tutorial-secondary">
              Capturar Pokémon
            </Link>
            <Link href="/batalha" className="tutorial-primary">
              Ir para batalha <Sword aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
