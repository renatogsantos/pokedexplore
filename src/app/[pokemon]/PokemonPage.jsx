"use client";
import ButtonPrimary from "@/components/ButtonPrimary";
import StatusBar from "@/components/StatusBar";
import Waves from "@/components/Waves";
import PokemonTypeIcon from "@/components/PokemonTypeIcon";
import { convertHeightToMeters, convertWeightToKilograms } from "@/helpers";
import { pokemonData } from "@/helpers/PokemonTypes";
import { getPokemonWeaknesses } from "@/redux/pokemons";
import { webStore } from "@/helpers/webStore";
import { getBattleMoves } from "@/lib/battle/engine";
import { getCompatibleTms, MAX_BATTLE_MOVES } from "@/lib/battle/tms";
import HeldItemDrawer from "@/components/HeldItemDrawer/HeldItemDrawer";
import {
  ArrowCircleLeft,
  Barbell,
  Gauge,
  HandFist,
  Heartbeat,
  Ruler,
  ShieldChevron,
  ShieldPlus,
  Sword,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";

const HELD_ITEMS = [
  { id: "oran", name: "Berry Oran", description: "Recupera 20% do HP automaticamente quando o HP cai para 50% ou menos." },
  { id: "sitrus", name: "Berry Sitrus", description: "Recupera 30% do HP automaticamente quando o HP cai para 50% ou menos." },
  { id: "type-boost", name: "Amplificador de tipo", description: "Aumenta em 10% os golpes do tipo principal deste Pokémon." },
];

const getHeldItemId = (item) => item?.endsWith("-boost") ? "type-boost" : item;
const getHeldItemInfo = (item) => HELD_ITEMS.find((entry) => entry.id === getHeldItemId(item));

export default function PokemonPage({ pokemon }) {
  const dispatch = useDispatch();
  const [color, setColor] = useState("#000");
  const [heldItem, setHeldItem] = useState(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [moveset, setMoveset] = useState([]);
  const [pendingTm, setPendingTm] = useState(null);
  const [economy, setEconomy] = useState({ inventory: {}, ownedTms: [] });
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [replacementItem, setReplacementItem] = useState(null);
  const [equipmentFeedback, setEquipmentFeedback] = useState("");
  const { Weaknesses, OpenCardPokemon } = useSelector(
    (state) => state.pokemons
  );

  function getColorByType(pokemonType) {
    const foundPokemon = pokemonData.find(
      (pokemon) => pokemon.type === pokemonType
    );
    if (foundPokemon) {
      return foundPokemon.color;
    } else {
      return null;
    }
  }
  const Color = getColorByType(pokemon.types[0].type.name);

  useEffect(() => {
    setColor(Color);
  }, []);

  useEffect(() => {
    dispatch(getPokemonWeaknesses(pokemon.name));
  }, [pokemon]);

  useEffect(() => {
    Promise.all([webStore.getData("Pokedex"), webStore.getEconomy()]).then(([collection, player]) => {
      const captured = collection.find((item) => String(item.id) === String(pokemon.id));
      setIsCaptured(Boolean(captured));
      setHeldItem(captured?.heldItem || null);
      setMoveset(captured?.moveset?.length ? captured.moveset : getBattleMoves(pokemon));
      setEconomy(player);
    });
  }, [pokemon.id]);

  async function equipHeldItem(item) {
    const result = await webStore.setHeldItem(pokemon.id, item);
    if (result?.ok) {
      setHeldItem(result.pokemon.heldItem);
      setEquipmentOpen(false);
      setReplacementItem(null);
      const equipped = getHeldItemInfo(result.pokemon.heldItem);
      setEquipmentFeedback(equipped ? `${equipped.name.toUpperCase()} ${equipped.id === "type-boost" ? "EQUIPADO" : "EQUIPADA"}! ${pokemon.name} agora está segurando ${equipped.name}. ${equipped.id === "type-boost" ? "O amplificador fica ativo passivamente durante a batalha." : "Ela será ativada automaticamente durante a batalha."}` : "Item removido. Este Pokémon entrará na batalha sem item segurado.");
    }
  }

  function requestEquipment(item) {
    if (item === heldItem) return;
    if (heldItem && item) { setReplacementItem(item); return; }
    void equipHeldItem(item);
  }

  async function learnTm(tm, replaceIndex) {
    const nextMoves = replaceIndex === undefined ? [...moveset, tm] : moveset.map((move, index) => index === replaceIndex ? tm : move);
    const updated = await webStore.setMoveset(pokemon.id, nextMoves);
    if (updated) { setMoveset(updated.moveset); setPendingTm(null); }
  }

  return (
    <div
      className="pokemon-page-home"
      style={{
        backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(150% 50% at 50% bottom, ${color}, #060e20cc)`,
      }}
    >
      <Container
        fluid
        className="py-3 py-lg-5 position-relative overflow-hidden text-light"
      >
        <Waves />
        <Container className="py-3 py-lg-5">
          <div className="d-flex align-items-center justify-content-center">
            <img
              loading="lazy"
              draggable={false}
              width="300"
              src="/pokedexplore.svg"
              alt="PokédExplore"
            />
          </div>
          <hr />
          <div className="text-center">
            <h1>{pokemon.name}</h1>
          </div>
          <p className="mb-4">
            Conheça o incrível Pokémon{" "}
            <span className="capitalize">{pokemon.name}</span>, um ser
            misterioso e poderoso com habilidades surpreendentes. Sua natureza
            se reflete em seus tipos:{" "}
            {pokemon.types.map((type, i) => {
              return (
                <span key={i} className="capitalize pe-1">
                  {type.type.name}
                </span>
              );
            })}
            . Seja em batalhas ou aventuras,
            <span className="capitalize"> {pokemon.name}</span> é um companheiro
            valioso e pronto para enfrentar qualquer desafio!
          </p>
          <Row className="align-items-center main-card my-4">
            <Col sm="12" xl="7" className="py-4">
              <div className="text-light p-3 p-lg-5">
                <div className="d-flex aling-items-center justify-content-between w-100 py-2 border-top border-bottom">
                  <div className="d-flex flex-column align-items-center justify-content-center w-100 text-center mx-2">
                    <span className="pokemon-stats mx-4 w-100">
                      {convertHeightToMeters(pokemon.height)} M
                    </span>
                    <p className="d-flex align-items-center m-0">
                      <Ruler size={24} weight="duotone" /> Altura
                    </p>
                  </div>
                  <div className="d-flex align-items-center justify-content-center w-100 gap-3 border-end border-start px-3">
                    {pokemon.types.map((type, i) => {
                      return (
                        <PokemonTypeIcon key={i} type={type.type.name} size={40} decorative />
                      );
                    })}
                  </div>
                  <div className="d-flex flex-column align-items-center justify-content-center w-100 text-center mx-2">
                    <span className="pokemon-stats mx-4 w-100">
                      {convertWeightToKilograms(pokemon.weight)} Kg
                    </span>
                    <p className="d-flex align-items-center m-0">
                      <Barbell size={24} weight="duotone" /> Peso
                    </p>
                  </div>
                </div>
                <div className="pt-4 w-100">
                  {pokemon.stats.map((stats, i) => {
                    return (
                      <Row key={i} className="align-items-center">
                        <Col xs="2" sm="1" className="py-2">
                          {stats.stat.name == "hp" ? (
                            <Heartbeat
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : stats.stat.name == "attack" ? (
                            <HandFist
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : stats.stat.name == "defense" ? (
                            <ShieldChevron
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : stats.stat.name == "special-attack" ? (
                            <Sword
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : stats.stat.name == "special-defense" ? (
                            <ShieldPlus
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : stats.stat.name == "speed" ? (
                            <Gauge
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : (
                            ""
                          )}
                        </Col>
                        <Col xs="2" sm="1">
                          <span>{stats.base_stat}</span>
                        </Col>
                        <Col xs="8" sm="3">
                          <span>{stats.stat.name}</span>
                        </Col>
                        <Col xs="12" sm>
                          <StatusBar status={stats.base_stat} />
                        </Col>
                      </Row>
                    );
                  })}
                  <div className="d-flex flex-column flex-lg-row gap-2 align-items-center py-3">
                    <span>Fraquezas:</span>
                    <div className="d-flex gap-2">
                      {Weaknesses.map((weak, i) => {
                        return (
                          <PokemonTypeIcon key={`${weak}-${i}`} type={weak} size={28} className="scale-in-center" label={`Fraco contra ${weak}`} />
                        );
                      })}
                    </div>
                  </div>
                  <section className="held-item-panel" aria-labelledby="held-item-title">
                    <div>
                      <span className="eyebrow">ITEM SEGURADO</span>
                      <h2 id="held-item-title">{getHeldItemInfo(heldItem)?.name || "Nenhum item equipado"}</h2>
                      <p>{isCaptured ? "Escolha um item. Cada Pokémon pode levar apenas um para a batalha." : "Capture este Pokémon para equipar um item."}</p>
                    </div>
                    {isCaptured && false && <div className="held-item-options" role="group" aria-label="Escolher item segurado">
                      <button type="button" className={!heldItem ? "selected" : ""} onClick={() => equipHeldItem(null)}>Sem item</button>
                      <button type="button" disabled={!economy.inventory?.oran && heldItem !== "oran"} className={heldItem === "oran" ? "selected" : ""} onClick={() => equipHeldItem("oran")}>Oran<br /><small>{economy.inventory?.oran || 0} disponível</small></button>
                      <button type="button" disabled={!economy.inventory?.sitrus && heldItem !== "sitrus"} className={heldItem === "sitrus" ? "selected" : ""} onClick={() => equipHeldItem("sitrus")}>Sitrus<br /><small>{economy.inventory?.sitrus || 0} disponível</small></button>
                      <button type="button" disabled={!economy.inventory?.["type-boost"] && heldItem !== pokemon.types[0].type.name + "-boost"} className={heldItem === pokemon.types[0].type.name + "-boost" ? "selected" : ""} onClick={() => equipHeldItem(pokemon.types[0].type.name + "-boost")}>Amplificador<br /><small>{economy.inventory?.["type-boost"] || 0} disponível</small></button>
                    </div>}
                    {equipmentFeedback && <p className="held-item-feedback" role="status">{equipmentFeedback}</p>}
                    {isCaptured && <div className="held-item-actions">
                      <button type="button" className="equipment-drawer-trigger" onClick={() => { setEquipmentOpen(true); setReplacementItem(null); }} aria-label={heldItem ? "Trocar item segurado" : "Equipar item segurado"}>+</button>
                      {heldItem && <button type="button" className="secondary" onClick={() => requestEquipment(null)}>Remover</button>}
                    </div>}
                    {false && equipmentOpen && <div className="held-item-selector" role="group" aria-label="Escolha um item segurado">
                      <strong>Escolha um item</strong>
                      {HELD_ITEMS.map((item) => {
                        const available = economy.inventory?.[item.id] || 0;
                        const storedItem = item.id === "type-boost" ? `${pokemon.types[0].type.name}-boost` : item.id;
                        const selected = heldItem === storedItem;
                        return <article key={item.id} className={selected ? "selected" : ""}><div><strong>{item.name}</strong><small>×{available} disponível</small><p>{item.description}</p></div><button type="button" disabled={!available && !selected} onClick={() => requestEquipment(storedItem)}>{selected ? "Equipado" : "Equipar"}</button></article>;
                      })}
                    </div>}
                    {false && replacementItem && <div className="held-item-confirm" role="alert"><strong>Trocar item?</strong><span>{getHeldItemInfo(heldItem)?.name} será substituído por {getHeldItemInfo(replacementItem)?.name}.</span><div><button type="button" className="secondary" onClick={() => setReplacementItem(null)}>Cancelar</button><button type="button" onClick={() => void equipHeldItem(replacementItem)}>Trocar item</button></div></div>}
                    <HeldItemDrawer pokemon={pokemon} economy={economy} heldItem={heldItem} open={equipmentOpen} onClose={() => setEquipmentOpen(false)} onEquipped={(updated, message) => { setHeldItem(updated.heldItem); setEquipmentFeedback(message); }} />
                  </section>
                  <section className="held-item-panel" aria-labelledby="moveset-title">
                    <div><span className="eyebrow">MOVIMENTOS</span><h2 id="moveset-title">{moveset.length}/{MAX_BATTLE_MOVES} espaços</h2><p>{pendingTm ? "Escolha qual movimento esquecer para aprender a TM." : "Seu moveset é usado diretamente na Arena."}</p></div>
                    {isCaptured && <><div className="moveset-slots">{moveset.map((move, index) => <button type="button" key={move.id + index} className={pendingTm ? "replace-target" : ""} onClick={() => pendingTm && learnTm(pendingTm, index)}><strong>{move.name}</strong><small>{move.type} · {move.power}</small></button>)}</div><div className="tm-list">{getCompatibleTms(pokemon).map((tm) => { const owned = economy.ownedTms?.includes(tm.id); return <button type="button" key={tm.id} disabled={!owned || moveset.some((move) => move.id === tm.id)} onClick={() => moveset.length < MAX_BATTLE_MOVES ? learnTm(tm) : setPendingTm(tm)}><strong>{tm.name}</strong><small>{owned ? `TM · ${tm.power} poder` : "Compre na Loja"}</small></button>; })}</div></>}
                  </section>
                </div>
              </div>
            </Col>
            <Col
              sm="12"
              xl="5"
              className="order-first order-xl-last text-center py-3"
            >
              <img
                loading="lazy"
                draggable={false}
                width="100%"
                src={
                  pokemon.sprites.other["official-artwork"].front_default
                    ? pokemon.sprites.other["official-artwork"].front_default
                    : pokemon.sprites.other.home.front_default
                    ? pokemon.sprites.other.home.front_default
                    : "pokenull.png"
                }
                alt={pokemon.name}
              />
            </Col>
          </Row>
          <div className="d-flex justify-content-center">
            <ButtonPrimary
              link="/#pokedex"
              title="Voltar"
              icon={<ArrowCircleLeft size={24} weight="duotone" />}
            />
          </div>
        </Container>
      </Container>
    </div>
  );
}
