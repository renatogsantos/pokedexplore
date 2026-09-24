"use client";

import {
  ArrowClockwise,
  Backpack,
  Check,
  Cloud,
  Coins,
  Database,
  DownloadSimple,
  Flask,
  GameController,
  HardDrives,
  Lightning,
  LockKey,
  MagnifyingGlass,
  Medal,
  Package,
  ShieldCheck,
  SignOut,
  Sparkle,
  Sword,
  Trash,
  UploadSimple,
  UserCircle,
  Warning,
  Wrench,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BadgeArtwork from "@/components/Badges/BadgeArtwork";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getHeldItemDefinition, HELD_ITEM_CATALOG } from "@/lib/economy/heldItems";
import { formatCoins } from "@/lib/economy";
import { getRarityLabel, getRoleLabel, getUsageLabel } from "@/lib/items/catalog";
import { getPokemonLevel, MAX_POKEMON_LEVEL } from "@/lib/pokemon/progression";
import { getPokemonRarity } from "@/lib/pokemon/rarity";
import { getPokemonSprite, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";
import { PLAYER_AVATARS } from "@/lib/profile/avatars";
import { getTrainerProgress } from "@/lib/profile/progression";
import { selectCollectionStats } from "@/lib/profile/selectors";
import {
  creatorAddPokemon,
  creatorAddPokemonGroup,
  creatorChangeCoins,
  creatorExportBackup,
  creatorGetItemStock,
  creatorGrantAllItems,
  creatorImportBackup,
  creatorRemovePokemon,
  creatorResetScope,
  creatorSetAllPokemonLevels,
  creatorSetHeldItem,
  creatorSetInfiniteCoins,
  creatorSetItemQuantity,
  creatorSetPokemonLevel,
  creatorSetTrainerLevel,
  creatorSetTrainerXp,
  creatorUpdateProfile,
  ITEM_CATALOG,
  loadCreatorLocalState,
  loadCreatorPokemonCatalog,
  loadCreatorSharedState,
} from "@/lib/creator/actions";

const TABS = [
  ["overview", "Overview", Database],
  ["player", "Player", UserCircle],
  ["pokemon", "Pokémon", GameController],
  ["items", "Items", Backpack],
  ["shared", "Shared", Cloud],
  ["system", "System", HardDrives],
  ["labs", "Labs", Flask],
];
const POKEMON_FILTERS = [
  ["all", "Todos"],
  ["owned", "Possuídos"],
  ["unowned", "Não possuídos"],
  ["legendary", "Lendários"],
  ["mythical", "Míticos"],
  ["custom", "Custom"],
  ["lv10", "Lv10"],
];
const PAGE_SIZE = 18;

function ScopeBadge({ shared = false }) {
  const Icon = shared ? Cloud : Database;
  return <span className={`creator-scope ${shared ? "is-shared" : "is-local"}`}><Icon size={14} weight="fill" aria-hidden="true" /> {shared ? "COMPARTILHADO" : "LOCAL"}</span>;
}

function PanelHeading({ eyebrow, title, description, shared = false, action }) {
  return <header className="creator-panel-heading"><div><span className="creator-kicker">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><div className="creator-panel-heading__aside"><ScopeBadge shared={shared} />{action}</div></header>;
}

function Metric({ Icon, label, value, detail }) {
  return <article className="creator-metric"><Icon size={22} weight="duotone" aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div></article>;
}

function ActionButton({ children, tone = "default", ...props }) {
  return <button type="button" className={`creator-button is-${tone}`} {...props}>{children}</button>;
}

function emptyLocalState() {
  return { profile: null, economy: { coins: 0, inventory: {}, progress: {} }, collection: [], decks: [], storage: null };
}

export default function CreatorControlCenter() {
  const [activeTab, setActiveTab] = useState("overview");
  const [local, setLocal] = useState(emptyLocalState);
  const [shared, setShared] = useState({ configured: false, badges: [], activeChallenge: null, tournament: null, error: "" });
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const importInput = useRef(null);

  const addLog = useCallback((message) => {
    const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
    setLogs((current) => [{ id: `${Date.now()}-${message}`, time, message }, ...current].slice(0, 12));
  }, []);

  const refreshLocal = useCallback(async () => {
    const next = await loadCreatorLocalState();
    setLocal(next);
    return next;
  }, []);

  const refreshShared = useCallback(async (playerId) => {
    if (!playerId) return;
    setShared(await loadCreatorSharedState(playerId));
  }, []);

  const refreshAll = useCallback(async () => {
    setError("");
    const next = await refreshLocal();
    await refreshShared(next.profile?.playerId);
  }, [refreshLocal, refreshShared]);

  useEffect(() => {
    let active = true;
    loadCreatorLocalState()
      .then(async (next) => {
        if (!active) return;
        setLocal(next);
        setLoading(false);
        const remote = await loadCreatorSharedState(next.profile?.playerId);
        if (active) setShared(remote);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError?.message || "Não foi possível ler o save local.");
        setLoading(false);
      });
    loadCreatorPokemonCatalog()
      .then((data) => { if (active) setCatalog(data); })
      .catch(() => { if (active) setError("O catálogo Pokémon não pôde ser carregado. Controles individuais continuam disponíveis para a coleção atual."); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  async function runAction(key, message, action) {
    if (busy) return null;
    setBusy(key);
    setError("");
    setFeedback("");
    try {
      const result = await action();
      if (result === false || result === null || result?.ok === false) {
        if (result?.reason === "reserved") throw new Error(`Existem ${result.reserved} unidade(s) equipadas. Remova os held items antes de reduzir abaixo desse total.`);
        throw new Error("A operação não pôde ser concluída no IndexedDB.");
      }
      await refreshLocal();
      setFeedback(message);
      addLog(message);
      return result;
    } catch (actionError) {
      setError(actionError?.message || "A operação falhou.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function downloadBackup() {
    const backup = await creatorExportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pokedexplore-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addLog("Backup completo exportado");
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy("import");
    setError("");
    try {
      await creatorImportBackup(JSON.parse(await file.text()));
      await refreshAll();
      setFeedback("Backup importado e save recarregado.");
      addLog("Backup importado");
    } catch (importError) {
      setError(importError?.message || "Backup inválido ou incompatível.");
    } finally {
      event.target.value = "";
      setBusy("");
    }
  }

  function requestConfirmation(config) {
    setConfirmation(config);
  }

  async function confirmPendingAction() {
    const current = confirmation;
    if (!current) return;
    const result = await runAction(current.key, current.success, current.action);
    if (result !== null) setConfirmation(null);
  }

  async function logout() {
    await fetch("/creator-control/api/session", { method: "DELETE" });
    window.location.reload();
  }

  const progression = getTrainerProgress(local.economy?.progress?.trainerXp);
  const collectionStats = selectCollectionStats(local.collection);
  const customCount = local.collection.filter((pokemon) => pokemon.isCustom || pokemon.source === "custom" || pokemon.customId).length;
  const totalItems = Object.values(local.economy?.inventory || {}).reduce((total, quantity) => total + Number(quantity || 0), 0);
  const equippedItems = local.collection.filter((pokemon) => pokemon.heldItem).length;

  return (
    <main className="creator-page" id="creator-main">
      <a className="creator-skip" href="#creator-content">Ir para o painel</a>
      <div className="creator-shell">
        <header className="creator-topbar">
          <div className="creator-brand"><div aria-hidden="true"><Lightning size={24} weight="fill" /></div><span><small>POKÉDEXPLORE</small><strong>CREATOR CONTROL CENTER</strong></span></div>
          <div className="creator-topbar__status"><span><i /> SESSION AUTHORIZED</span><button type="button" onClick={logout}><SignOut size={18} aria-hidden="true" /> Sair</button></div>
        </header>

        <div className="creator-layout">
          <aside className="creator-sidebar">
            <div className="creator-god-badge"><Sparkle size={19} weight="fill" aria-hidden="true" /><span>GOD MODE<small>{local.economy?.creatorMode?.infiniteCoins ? "∞ moedas ativo" : "controle local"}</small></span></div>
            <nav aria-label="Seções do Creator Center">{TABS.map(([id, label, Icon]) => <button key={id} type="button" className={activeTab === id ? "is-active" : ""} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? "page" : undefined}><Icon size={19} aria-hidden="true" /><span>{label}</span></button>)}</nav>
            <section className="creator-action-log" aria-labelledby="creator-log-title"><header><span id="creator-log-title">DEV ACTION LOG</span><small>sessão atual</small></header>{logs.length ? <ol>{logs.map((entry) => <li key={entry.id}><time>{entry.time}</time><span>{entry.message}</span></li>)}</ol> : <p>Nenhuma alteração nesta sessão.</p>}</section>
          </aside>

          <section className="creator-workspace" id="creator-content" tabIndex={-1}>
            <nav className="creator-mobile-tabs" aria-label="Seções do Creator Center">{TABS.map(([id, label, Icon]) => <button key={id} type="button" className={activeTab === id ? "is-active" : ""} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? "page" : undefined}><Icon size={17} aria-hidden="true" />{label}</button>)}</nav>
            {(error || feedback) && <div className={`creator-feedback ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>{error ? <Warning size={20} weight="fill" aria-hidden="true" /> : <Check size={20} weight="bold" aria-hidden="true" />}<span>{error || feedback}</span><button type="button" aria-label="Fechar mensagem" onClick={() => { setError(""); setFeedback(""); }}>×</button></div>}
            {loading ? <div className="creator-loading"><ArrowClockwise size={28} aria-hidden="true" /><strong>LENDO SAVE LOCAL</strong><span>PokedExploreDB // schema v3</span></div> : <>
              {activeTab === "overview" && <OverviewTab local={local} shared={shared} progression={progression} collectionStats={collectionStats} customCount={customCount} totalItems={totalItems} equippedItems={equippedItems} onRefresh={refreshAll} busy={busy} />}
              {activeTab === "player" && <PlayerTab local={local} progression={progression} busy={busy} runAction={runAction} />}
              {activeTab === "pokemon" && <PokemonTab local={local} catalog={catalog} catalogLoading={catalogLoading} busy={busy} runAction={runAction} requestConfirmation={requestConfirmation} />}
              {activeTab === "items" && <ItemsTab local={local} busy={busy} runAction={runAction} requestConfirmation={requestConfirmation} />}
              {activeTab === "shared" && <SharedTab shared={shared} onRefresh={() => refreshShared(local.profile?.playerId)} busy={busy} />}
              {activeTab === "system" && <SystemTab local={local} busy={busy} downloadBackup={downloadBackup} importInput={importInput} requestConfirmation={requestConfirmation} />}
              {activeTab === "labs" && <LabsTab />}
            </>}
          </section>
        </div>
      </div>
      <input ref={importInput} className="creator-visually-hidden" type="file" accept="application/json" onChange={importBackup} />
      <ConfirmationDialog
        open={Boolean(confirmation)}
        eyebrow={confirmation?.eyebrow || "AÇÃO LOCAL"}
        title={confirmation?.title || "Confirmar operação?"}
        description={confirmation?.description || "Esta operação modificará o save deste dispositivo."}
        cancelLabel="Cancelar"
        confirmLabel={confirmation?.confirmLabel || "Confirmar"}
        busyLabel="Executando..."
        busy={Boolean(busy)}
        error={error}
        secondaryLabel={confirmation?.backup ? "Exportar backup" : ""}
        onSecondary={downloadBackup}
        onCancel={() => !busy && setConfirmation(null)}
        onConfirm={confirmPendingAction}
        id="creator-confirmation"
      />
    </main>
  );
}

function OverviewTab({ local, shared, progression, collectionStats, customCount, totalItems, equippedItems, onRefresh, busy }) {
  const championBadges = shared.badges.filter((badge) => badge.owner_player_id === local.profile?.playerId).length;
  return <div className="creator-tab"><PanelHeading eyebrow="SYSTEM OVERVIEW" title="Estado atual" description="Leitura ao vivo das fontes reais do jogo. Nenhum valor abaixo é demonstrativo." action={<ActionButton onClick={onRefresh} disabled={Boolean(busy)}><ArrowClockwise size={17} /> Atualizar</ActionButton>} />
    <section className="creator-metric-grid" aria-label="Resumo do estado local">
      <Metric Icon={UserCircle} label="Trainer" value={local.profile?.displayName || "Treinador"} detail={`Lv. ${progression.level} · ${formatCoins(progression.totalXp)} XP`} />
      <Metric Icon={Coins} label="Economy" value={local.economy?.creatorMode?.infiniteCoins ? "∞" : formatCoins(local.economy?.coins)} detail={local.economy?.creatorMode?.infiniteCoins ? `${formatCoins(local.economy?.coins)} persistidas` : "moedas locais"} />
      <Metric Icon={GameController} label="Collection" value={collectionStats.total} detail={`${collectionStats.maxLevel} Lv10 · ${customCount} custom`} />
      <Metric Icon={Backpack} label="Items" value={formatCoins(totalItems)} detail={`${equippedItems} equipados`} />
      <Metric Icon={Medal} label="Badges" value={shared.configured ? championBadges : "—"} detail={shared.activeChallenge ? "challenge ativo" : shared.configured ? "sem challenge ativo" : "serviço indisponível"} />
      <Metric Icon={HardDrives} label="Storage" value={`v${local.storage?.version || "—"}`} detail={`${local.storage?.stores?.pokedex?.count || 0} pokédex · ${local.storage?.stores?.player?.count || 0} player`} />
    </section>
    <div className="creator-overview-columns"><section className="creator-card"><header><div><span className="creator-kicker">PLAYER IDENTITY</span><h3>{local.profile?.displayName}</h3></div><ScopeBadge /></header><dl><div><dt>playerId</dt><dd>{local.profile?.playerId}</dd></div><div><dt>Avatar</dt><dd>{local.profile?.avatarId}</dd></div><div><dt>Decks</dt><dd>{local.decks.length}</dd></div><div><dt>Trainer XP</dt><dd>{progression.totalXp}</dd></div></dl></section>
      <section className="creator-card"><header><div><span className="creator-kicker">COLLECTION SIGNALS</span><h3>Pokédex local</h3></div><ScopeBadge /></header><dl><div><dt>Lendários</dt><dd>{collectionStats.legendary}</dd></div><div><dt>Míticos</dt><dd>{collectionStats.mythical}</dd></div><div><dt>Lv10</dt><dd>{collectionStats.maxLevel}</dd></div><div><dt>Custom</dt><dd>{customCount}</dd></div></dl></section>
      <section className="creator-card is-shared"><header><div><span className="creator-kicker">COMPETITIVE</span><h3>Estado compartilhado</h3></div><ScopeBadge shared /></header>{shared.error ? <p className="creator-muted">{shared.error}</p> : <dl><div><dt>Insígnias</dt><dd>{shared.badges.length}</dd></div><div><dt>Challenge</dt><dd>{shared.activeChallenge?.status || "Nenhum"}</dd></div><div><dt>Tournament</dt><dd>{shared.tournament?.status || "Nenhum"}</dd></div><div><dt>Modo</dt><dd>Somente leitura</dd></div></dl>}</section></div>
  </div>;
}

function PlayerTab({ local, progression, busy, runAction }) {
  const [name, setName] = useState(local.profile?.displayName || "Treinador");
  const [avatarId, setAvatarId] = useState(local.profile?.avatarId || "avatar-01");
  const [xp, setXp] = useState(String(progression.totalXp));
  const [level, setLevel] = useState(String(progression.level));
  const [coinValue, setCoinValue] = useState("100");
  useEffect(() => { setName(local.profile?.displayName || "Treinador"); setAvatarId(local.profile?.avatarId || "avatar-01"); setXp(String(progression.totalXp)); setLevel(String(progression.level)); }, [local.profile, progression.level, progression.totalXp]);
  const infiniteCoins = Boolean(local.economy?.creatorMode?.infiniteCoins);
  return <div className="creator-tab"><PanelHeading eyebrow="PLAYER CONTROL" title="Treinador" description="Nome, avatar, XP e economia usam o mesmo perfil e os mesmos repositories das telas públicas." />
    <section className="creator-card creator-coins-control"><header><div><span className="creator-kicker">GOD MODE // ECONOMY</span><h3>Moedas</h3></div><ScopeBadge /></header><div className="creator-coins-readout"><img src="/coin.png" alt="" /><div><span>SALDO ATUAL</span><strong>{infiniteCoins ? "∞" : formatCoins(local.economy?.coins)}</strong><small>{infiniteCoins ? `${formatCoins(local.economy?.coins)} moedas persistidas · compras não descontam` : "economia local normal"}</small></div><button type="button" className={infiniteCoins ? "is-active" : ""} aria-pressed={infiniteCoins} disabled={Boolean(busy)} onClick={() => runAction("coins-infinite", infiniteCoins ? "Moedas ilimitadas desativadas" : "Moedas ilimitadas ativadas", () => creatorSetInfiniteCoins(!infiniteCoins))}><Lightning size={18} weight="fill" /> ∞ MOEDAS</button></div><div className="creator-quick-actions">{[15, 100, 1000, 10000, 1000000].map((amount) => <ActionButton key={amount} disabled={Boolean(busy)} onClick={() => runAction(`coins-${amount}`, `+${formatCoins(amount)} moedas`, () => creatorChangeCoins("add", amount))}>+{formatCoins(amount)}</ActionButton>)}</div><label htmlFor="creator-coins-value">Valor personalizado</label><div className="creator-coins-form"><input id="creator-coins-value" type="number" min="0" value={coinValue} onChange={(event) => setCoinValue(event.target.value)} /><ActionButton disabled={Boolean(busy)} onClick={() => runAction("coins-add", `+${formatCoins(coinValue)} moedas`, () => creatorChangeCoins("add", coinValue))}>Adicionar</ActionButton><ActionButton disabled={Boolean(busy)} onClick={() => runAction("coins-set", `Saldo definido em ${formatCoins(coinValue)}`, () => creatorChangeCoins("set", coinValue))}>Definir saldo</ActionButton><ActionButton disabled={Boolean(busy)} onClick={() => runAction("coins-remove", `-${formatCoins(coinValue)} moedas`, () => creatorChangeCoins("remove", coinValue))}>Remover</ActionButton><ActionButton tone="danger" disabled={Boolean(busy)} onClick={() => runAction("coins-zero", "Saldo zerado", () => creatorChangeCoins("set", 0))}>Zerar</ActionButton></div></section>
    <div className="creator-two-columns"><section className="creator-card creator-profile-editor"><header><div><span className="creator-kicker">IDENTIDADE</span><h3>Perfil local</h3></div><ScopeBadge /></header><div className="creator-profile-preview"><PlayerAvatar avatarId={avatarId} className="creator-profile-avatar" eager /><div><strong>{name || "Treinador"}</strong><span>Treinador Lv. {progression.level}</span></div></div><label htmlFor="creator-name">Display name</label><input id="creator-name" value={name} maxLength={18} onChange={(event) => setName(event.target.value)} /><fieldset><legend>Avatar</legend><div className="creator-avatar-grid">{PLAYER_AVATARS.map((avatar) => <button key={avatar.id} type="button" className={avatarId === avatar.id ? "is-selected" : ""} aria-label={avatar.label} aria-pressed={avatarId === avatar.id} onClick={() => setAvatarId(avatar.id)}><PlayerAvatar avatarId={avatar.id} />{avatarId === avatar.id && <Check size={15} weight="bold" aria-hidden="true" />}</button>)}</div></fieldset><ActionButton tone="primary" disabled={Boolean(busy) || !name.trim()} onClick={() => runAction("profile", `Perfil atualizado: ${name.trim()}`, () => creatorUpdateProfile({ ...local.profile, displayName: name, avatarId }))}>Salvar perfil</ActionButton></section>
      <section className="creator-card"><header><div><span className="creator-kicker">TRAINER PROGRESSION</span><h3>XP derivado</h3></div><ScopeBadge /></header><div className="creator-level-readout"><strong>NV. {progression.level}</strong><span>{progression.currentXp} / {progression.nextLevelXp} XP no nível</span><i><b style={{ width: `${progression.percent}%` }} /></i></div><label htmlFor="creator-xp">XP total</label><div className="creator-inline-form"><input id="creator-xp" type="number" min="0" value={xp} onChange={(event) => setXp(event.target.value)} /><ActionButton disabled={Boolean(busy)} onClick={() => runAction("xp-set", `Trainer XP definido em ${Math.max(0, Number(xp) || 0)}`, () => creatorSetTrainerXp(xp))}>Definir</ActionButton></div><div className="creator-quick-actions"><ActionButton disabled={Boolean(busy)} onClick={() => runAction("xp-add", "+100 Trainer XP", () => creatorSetTrainerXp(progression.totalXp + 100))}>+100 XP</ActionButton><ActionButton disabled={Boolean(busy)} onClick={() => runAction("xp-add-1000", "+1.000 Trainer XP", () => creatorSetTrainerXp(progression.totalXp + 1000))}>+1.000 XP</ActionButton></div><label htmlFor="creator-level">Definir nível pela função central</label><div className="creator-inline-form"><input id="creator-level" type="number" min="1" max="100" value={level} onChange={(event) => setLevel(event.target.value)} /><ActionButton disabled={Boolean(busy)} onClick={() => runAction("level-set", `Trainer Level definido em ${Math.max(1, Number(level) || 1)}`, () => creatorSetTrainerLevel(level))}>Aplicar</ActionButton></div><small className="creator-help">O nível não é salvo separadamente: o painel calcula o XP acumulado necessário.</small></section></div>
    <section className="creator-card creator-id-diagnostic"><header><div><span className="creator-kicker">DIAGNÓSTICO</span><h3>Player ID</h3></div><LockKey size={21} aria-hidden="true" /></header><code>{local.profile?.playerId}</code><p>Somente leitura. Alterar esta identidade desconectaria referências competitivas compartilhadas e não é uma ação comum do painel.</p><ActionButton onClick={() => navigator.clipboard?.writeText(local.profile?.playerId || "")}>Copiar ID</ActionButton></section>
  </div>;
}

function PokemonTab({ local, catalog, catalogLoading, busy, runAction, requestConfirmation }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const ownedById = useMemo(() => new Map(local.collection.map((pokemon) => [String(pokemon.id), pokemon])), [local.collection]);
  const source = catalog.length ? catalog : local.collection;
  const filtered = useMemo(() => source.filter((pokemon) => {
    const owned = ownedById.get(String(pokemon.id));
    const rarity = getPokemonRarity(pokemon);
    const custom = pokemon.isCustom || pokemon.source === "custom" || pokemon.customId;
    const matchesQuery = `${pokemon.name} ${pokemon.displayName || ""} ${pokemon.id}`.toLowerCase().includes(query.trim().toLowerCase());
    if (!matchesQuery) return false;
    if (filter === "owned") return Boolean(owned);
    if (filter === "unowned") return !owned;
    if (filter === "legendary") return rarity === "legendary";
    if (filter === "mythical") return rarity === "mythical";
    if (filter === "custom") return Boolean(custom);
    if (filter === "lv10") return owned && getPokemonLevel(owned) === MAX_POKEMON_LEVEL;
    return true;
  }).sort((a, b) => Number(a.id) - Number(b.id)), [filter, ownedById, query, source]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [filter, query]);
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);

  const confirmBulk = (key, title, description, success, action) => requestConfirmation({ key, title, description, success, action, confirmLabel: "Confirmar" });
  return <div className="creator-tab"><PanelHeading eyebrow="POKÉMON CONTROL" title="Coleção local" description="Busca no catálogo compartilhado da Loja; captura, nível e shiny continuam derivados das regras centrais." />
    <section className="creator-card creator-bulk-card"><header><div><span className="creator-kicker">QUICK ACTIONS</span><h3>Operações em massa</h3></div><ScopeBadge /></header><div className="creator-quick-actions"><ActionButton disabled={catalogLoading || Boolean(busy)} onClick={() => confirmBulk("complete", "Completar Pokédex?", `Isso adicionará os Pokémon ausentes do catálogo atual (${catalog.length} entradas) ao save local sem disparar requests individuais.`, "Pokédex local completada", () => creatorAddPokemonGroup(catalog))}><Package size={17} /> Completar Pokédex</ActionButton><ActionButton disabled={!local.collection.length || Boolean(busy)} onClick={() => confirmBulk("lv10-all", "Definir todos no Lv10?", "Todos os Pokémon já possuídos terão o nível local definido como 10.", "Todos os Pokémon definidos no Lv10", () => creatorSetAllPokemonLevels(10))}><Sparkle size={17} /> Todos Lv10</ActionButton><ActionButton disabled={catalogLoading || Boolean(busy)} onClick={() => { const entries = catalog.filter((pokemon) => getPokemonRarity(pokemon) === "legendary"); confirmBulk("legendary-all", "Adicionar todos os lendários?", `${entries.length} entradas lendárias serão comparadas com sua coleção local.`, "Todos os lendários disponíveis foram adicionados", () => creatorAddPokemonGroup(entries)); }}>Lendários</ActionButton><ActionButton disabled={catalogLoading || Boolean(busy)} onClick={() => { const entries = catalog.filter((pokemon) => getPokemonRarity(pokemon) === "mythical"); confirmBulk("mythical-all", "Adicionar todos os míticos?", `${entries.length} entradas míticas serão comparadas com sua coleção local.`, "Todos os míticos disponíveis foram adicionados", () => creatorAddPokemonGroup(entries)); }}>Míticos</ActionButton><ActionButton disabled={catalogLoading || Boolean(busy)} onClick={() => { const entries = catalog.filter((pokemon) => pokemon.isCustom || pokemon.source === "custom" || pokemon.customId); confirmBulk("custom-all", "Adicionar Pokémon customizados?", `${entries.length} Pokémon customizados do catálogo central serão adicionados quando ausentes.`, "Pokémon customizados adicionados", () => creatorAddPokemonGroup(entries)); }}>Custom</ActionButton></div></section>
    <div className="creator-browser-controls"><label><MagnifyingGlass size={19} aria-hidden="true" /><span className="creator-visually-hidden">Buscar Pokémon</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar Pokémon por nome ou ID" /></label><div className="creator-filter-row" aria-label="Filtrar Pokémon">{POKEMON_FILTERS.map(([id, label]) => <button key={id} type="button" className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
    <div className="creator-results-heading"><span>{catalogLoading ? "Carregando catálogo…" : `${filtered.length} resultados`}</span><small>Página {page} de {pages}</small></div>
    <section className="creator-pokemon-grid" aria-live="polite">{visible.map((pokemon) => { const owned = ownedById.get(String(pokemon.id)); const display = owned || pokemon; const level = owned ? getPokemonLevel(owned) : 0; return <article key={`${pokemon.source || "pokeapi"}-${pokemon.id}`} className={`creator-pokemon-card ${owned ? "is-owned" : ""}`}><div className="creator-pokemon-card__image"><img src={getPokemonSprite({ pokemon: display, context: SPRITE_CONTEXT.GENERAL })} alt="" loading="lazy" /><span>#{pokemon.id}</span></div><div className="creator-pokemon-card__body"><span>{(pokemon.isCustom || pokemon.source === "custom") ? "CUSTOM" : getPokemonRarity(pokemon).toUpperCase()}</span><h3>{pokemon.displayName || pokemon.name}</h3>{owned ? <><p>Possuído · Lv. {level}{level > 5 ? " · Shiny" : ""}</p><div className="creator-level-controls"><ActionButton disabled={Boolean(busy) || level <= 1} aria-label={`Diminuir nível de ${pokemon.name}`} onClick={() => runAction(`pokemon-${pokemon.id}`, `${pokemon.name} → Lv${level - 1}`, () => creatorSetPokemonLevel(pokemon.id, level - 1))}>−</ActionButton><input aria-label={`Nível de ${pokemon.name}`} type="number" min="1" max="10" value={level} onChange={(event) => runAction(`pokemon-${pokemon.id}`, `${pokemon.name} → Lv${event.target.value}`, () => creatorSetPokemonLevel(pokemon.id, event.target.value))} /><ActionButton disabled={Boolean(busy) || level >= 10} aria-label={`Aumentar nível de ${pokemon.name}`} onClick={() => runAction(`pokemon-${pokemon.id}`, `${pokemon.name} → Lv${level + 1}`, () => creatorSetPokemonLevel(pokemon.id, level + 1))}>+</ActionButton><ActionButton tone="gold" disabled={Boolean(busy) || level === 10} onClick={() => runAction(`pokemon-${pokemon.id}`, `${pokemon.name} → Lv10`, () => creatorSetPokemonLevel(pokemon.id, 10))}>Lv10</ActionButton></div><ActionButton tone="danger" disabled={Boolean(busy)} onClick={() => runAction(`pokemon-remove-${pokemon.id}`, `${pokemon.name} removido da coleção`, () => creatorRemovePokemon(pokemon.id))}><Trash size={16} /> Remover</ActionButton></> : <><p>Não possuído</p><ActionButton tone="primary" disabled={Boolean(busy)} onClick={() => runAction(`pokemon-add-${pokemon.id}`, `${pokemon.name} adicionado à coleção`, () => creatorAddPokemon(pokemon))}>Adicionar à coleção</ActionButton></>}</div></article>; })}</section>
    {!visible.length && !catalogLoading && <div className="creator-empty"><GameController size={34} /><strong>Nenhum Pokémon encontrado</strong><span>Ajuste a busca ou o filtro.</span></div>}
    {pages > 1 && <nav className="creator-pagination" aria-label="Paginação Pokémon"><ActionButton disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</ActionButton><span>{page} / {pages}</span><ActionButton disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Próxima</ActionButton></nav>}
  </div>;
}

function ItemsTab({ local, busy, runAction, requestConfirmation }) {
  const [drafts, setDrafts] = useState({});
  const [selectedPokemonId, setSelectedPokemonId] = useState(String(local.collection[0]?.id || ""));
  useEffect(() => { if (!local.collection.some((pokemon) => String(pokemon.id) === selectedPokemonId)) setSelectedPokemonId(String(local.collection[0]?.id || "")); }, [local.collection, selectedPokemonId]);
  const selectedPokemon = local.collection.find((pokemon) => String(pokemon.id) === selectedPokemonId);
  const equippedDefinition = getHeldItemDefinition(selectedPokemon?.heldItem);
  const confirmItems = (quantity, label) => requestConfirmation({ key: `items-${quantity}`, title: `${label}?`, description: `A quantidade mínima de cada item do ITEM_CATALOG será definida como ${quantity} neste save local.`, success: `${label} concluído`, action: () => creatorGrantAllItems(quantity), confirmLabel: "Confirmar" });
  return <div className="creator-tab"><PanelHeading eyebrow="ITEM CONTROL" title="Inventário original" description="As 28 definições vêm diretamente do ITEM_CATALOG; reservas de held items são validadas antes de qualquer redução." />
    <section className="creator-card creator-bulk-card"><header><div><span className="creator-kicker">QUICK ACTIONS</span><h3>Catálogo completo</h3></div><ScopeBadge /></header><div className="creator-quick-actions"><ActionButton disabled={Boolean(busy)} onClick={() => confirmItems(1, "Dar todos os itens")}><Package size={17} /> Dar todos os itens</ActionButton><ActionButton tone="gold" disabled={Boolean(busy)} onClick={() => confirmItems(99, "Dar 99 de cada item")}><Sparkle size={17} /> 99 de cada</ActionButton></div></section>
    <section className="creator-item-grid">{ITEM_CATALOG.map((item) => { const stock = creatorGetItemStock({ economy: local.economy, collection: local.collection, itemId: item.id }); const owned = local.economy.inventory?.[item.id] || 0; const draft = drafts[item.id] ?? String(owned); return <article key={item.id} className={`creator-item-card rarity-${item.rarity.toLowerCase()}`}><div className="creator-item-card__head"><ItemSprite item={item.id} alt={item.name} /><div><span>{getRarityLabel(item.rarity)} · {getUsageLabel(item.usageType)}</span><h3>{item.name}</h3><small>{getRoleLabel(item.role)} · {item.category}</small></div></div><p>{item.shortDescription}</p><dl><div><dt>Possui</dt><dd>{owned}</dd></div><div><dt>Reservado</dt><dd>{stock.equipped}</dd></div><div><dt>Disponível</dt><dd>{stock.available}</dd></div></dl><div className="creator-item-quick">{[1, 5, 10, 99].map((amount) => <ActionButton key={amount} disabled={Boolean(busy)} onClick={() => runAction(`item-${item.id}`, `+${amount} ${item.name}`, () => creatorSetItemQuantity(item.id, owned + amount))}>+{amount}</ActionButton>)}</div><label htmlFor={`item-${item.id}`}>Definir quantidade</label><div className="creator-inline-form"><input id={`item-${item.id}`} type="number" min={stock.equipped} max="999999" value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /><ActionButton disabled={Boolean(busy)} onClick={() => runAction(`item-${item.id}`, `${item.name}: ${Math.max(0, Number(draft) || 0)}`, () => creatorSetItemQuantity(item.id, draft))}>Definir</ActionButton></div><ActionButton tone="danger" disabled={Boolean(busy) || !owned} onClick={() => runAction(`item-zero-${item.id}`, `${item.name} zerado`, () => creatorSetItemQuantity(item.id, 0))}>Zerar</ActionButton></article>; })}</section>
    <section className="creator-card creator-held-editor"><header><div><span className="creator-kicker">HELD ITEMS</span><h3>Equipamento validado</h3></div><ScopeBadge /></header>{local.collection.length ? <div className="creator-held-grid"><label>Pokémon<select value={selectedPokemonId} onChange={(event) => setSelectedPokemonId(event.target.value)}>{local.collection.map((pokemon) => <option key={pokemon.id} value={pokemon.id}>{pokemon.displayName || pokemon.name} · Lv{getPokemonLevel(pokemon)}</option>)}</select></label><div className="creator-held-current"><span>Item atual</span><strong>{equippedDefinition?.name || "Nenhum"}</strong><small>{equippedDefinition?.shortDescription || "Selecione um item disponível no inventário."}</small></div><label>Equipar item<select value={selectedPokemon?.heldItem || ""} onChange={(event) => runAction(`held-${selectedPokemonId}`, event.target.value ? `${selectedPokemon.name} equipou ${getHeldItemDefinition(event.target.value)?.name}` : `${selectedPokemon.name} removeu o held item`, () => creatorSetHeldItem(selectedPokemonId, event.target.value))}><option value="">Nenhum</option>{HELD_ITEM_CATALOG.map((item) => { const stock = creatorGetItemStock({ economy: local.economy, collection: local.collection, itemId: item.id }); const selected = selectedPokemon?.heldItem === item.id; return <option key={item.id} value={item.id} disabled={!selected && stock.available <= 0}>{item.name} · {stock.available} livre(s)</option>; })}</select></label></div> : <div className="creator-empty"><GameController size={32} /><strong>Nenhum Pokémon possuído</strong><span>Adicione um Pokémon antes de equipar held items.</span></div>}</section>
  </div>;
}

function SharedTab({ shared, onRefresh, busy }) {
  return <div className="creator-tab"><PanelHeading eyebrow="COMPETITIVE STATE" title="Estado compartilhado" description="Leitura via cliente público e políticas existentes do Supabase. Ações administrativas globais permanecem desabilitadas." shared action={<ActionButton onClick={onRefresh} disabled={Boolean(busy)}><ArrowClockwise size={17} /> Atualizar</ActionButton>} />
    <div className="creator-shared-warning"><ShieldCheck size={24} weight="fill" aria-hidden="true" /><div><strong>Fronteira segura preservada</strong><p>Este bundle não contém service-role key. Liberar, transferir, resetar defesas ou cancelar desafios de terceiros exige uma futura API server-side com autorização própria.</p></div></div>
    {!shared.configured ? <div className="creator-empty"><Cloud size={38} /><strong>Supabase não configurado</strong><span>O save local continua totalmente disponível.</span></div> : shared.error ? <div className="creator-empty is-error"><Warning size={38} /><strong>Falha na leitura compartilhada</strong><span>{shared.error}</span></div> : <><section className="creator-shared-summary"><Metric Icon={Medal} label="Badges" value={`${shared.badges.length}/18`} detail="registros compartilhados" /><Metric Icon={Sword} label="Challenge" value={shared.activeChallenge?.status || "Nenhum"} detail={shared.activeChallenge?.id || "sem disputa ativa"} /><Metric Icon={GameController} label="Tournament" value={shared.tournament?.status || "Nenhum"} detail={shared.tournament?.code || "sem campeonato ativo"} /></section><section className="creator-badge-grid">{shared.badges.map((badge) => <article key={badge.id || badge.code} style={{ "--badge-color": badge.config?.color || "#5ee6ff" }}><BadgeArtwork badge={badge.config || badge} decorative /><div><span>{badge.config?.localizedTypeName || badge.code}</span><h3>{badge.config?.name || badge.code}</h3><p>{badge.owner_display_name || "Livre"}</p><small>{badge.status || "AVAILABLE"} · {badge.defense_count || 0} defesas</small>{badge.activeChallenge && <em>Challenge {badge.activeChallenge.status}</em>}</div></article>)}</section></>}
  </div>;
}

function SystemTab({ local, busy, downloadBackup, importInput, requestConfirmation }) {
  const reset = (scope, title, description, success) => requestConfirmation({ key: `reset-${scope}`, eyebrow: "AÇÃO DESTRUTIVA", title, description, success, action: () => creatorResetScope(scope), confirmLabel: "Resetar", backup: true });
  return <div className="creator-tab"><PanelHeading eyebrow="SAVE INSPECTOR" title="PokedExploreDB" description="Backup v2 preserva pokédex, player, decks, perfil, economia e cache; importação v1 continua compatível." />
    <section className="creator-storage-grid">{Object.entries(local.storage?.stores || {}).map(([name, store]) => <article key={name}><Database size={22} weight="duotone" aria-hidden="true" /><span>{name}</span><strong>{store.count}</strong><small>registros</small></article>)}</section>
    <section className="creator-card creator-backup-card"><header><div><span className="creator-kicker">BACKUP / RESTORE</span><h3>Save completo</h3></div><ScopeBadge /></header><div className="creator-quick-actions"><ActionButton tone="primary" onClick={downloadBackup} disabled={Boolean(busy)}><DownloadSimple size={18} /> Exportar save</ActionButton><ActionButton onClick={() => importInput.current?.click()} disabled={Boolean(busy)}><UploadSimple size={18} /> Importar save</ActionButton></div><p>A importação substitui o conteúdo do backup correspondente. Exporte uma cópia antes de restaurar.</p></section>
    <section className="creator-card creator-inspector"><header><div><span className="creator-kicker">PLAYER STORE</span><h3>Registros relevantes</h3></div><code>schema v{local.storage?.version}</code></header><pre>{JSON.stringify(local.storage?.stores?.player?.records || [], null, 2)}</pre></section>
    <section className="creator-danger-zone"><header><Warning size={25} weight="fill" aria-hidden="true" /><div><span className="creator-kicker">DANGER ZONE</span><h3>Reset local</h3><p>Cada ação pede confirmação e oferece backup antes da exclusão.</p></div></header><div><ActionButton tone="danger" disabled={Boolean(busy)} onClick={() => reset("collection", "Resetar coleção local?", "Todos os Pokémon deste dispositivo serão removidos. Decks podem ficar incompletos.", "Coleção local resetada")}><Trash size={17} /> Coleção</ActionButton><ActionButton tone="danger" disabled={Boolean(busy)} onClick={() => reset("inventory", "Resetar inventário local?", "Todo o inventário será zerado e held items serão removidos atomicamente para evitar equipamentos fantasma.", "Inventário e held items resetados")}><Trash size={17} /> Inventário</ActionButton><ActionButton tone="danger" disabled={Boolean(busy)} onClick={() => reset("profile", "Resetar identidade local?", "Um novo playerId será gerado no próximo carregamento. Isso não transfere ou apaga ownership compartilhado no Supabase.", "Perfil local resetado")}><Trash size={17} /> Perfil</ActionButton><ActionButton tone="danger" disabled={Boolean(busy)} onClick={() => reset("all", "Resetar todo o save local?", "Pokédex, economia, inventário, progresso, decks e identidade deste dispositivo serão apagados. O estado compartilhado não será alterado.", "Todo o save local foi resetado")}><Trash size={17} /> Resetar tudo</ActionButton></div></section>
  </div>;
}

function LabsTab() {
  return <div className="creator-tab"><PanelHeading eyebrow="DEVELOPMENT LABS" title="Fase 2 preparada" description="Estes módulos exigem contratos explícitos com o Battle Engine e não foram simulados com estado paralelo." />
    <section className="creator-lab-grid"><article><div><Sword size={25} weight="duotone" aria-hidden="true" /><span>PHASE 2</span></div><h3>Battle Lab</h3><p>HP, status, Special e cenários de item precisam entrar como configuração DEV validada por <code>createBattleState</code>, sem condicionais de God Mode no motor.</p><button type="button" disabled>Contrato pendente</button></article><article><div><Lightning size={25} weight="duotone" aria-hidden="true" /><span>PHASE 2</span></div><h3>VFX Lab</h3><p>Não existe rota <code>/dev/vfx</code> nem BattleVFXEngine dedicado neste checkout. O painel não cria uma ferramenta falsa.</p><button type="button" disabled>Ferramenta ausente</button></article><article><div><Wrench size={25} weight="duotone" aria-hidden="true" /><span>PHASE 3</span></div><h3>Command Palette</h3><p>Ctrl/Cmd + K será conectado às mesmas Creator Actions depois que os contratos de laboratório estiverem estáveis.</p><button type="button" disabled>Planejado</button></article></section>
  </div>;
}
