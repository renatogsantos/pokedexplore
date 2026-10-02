import { before, after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRankingTestDatabase } from "../../../scripts/ranking-test-db.mjs";
import { BADGE_CONFIG } from "../badges/config.js";
import { POKEMON_MASTER_BONUS_COINS } from "../profile/pokemonMaster.js";

let db;
const query = async (sql, args=[]) => (await db.query(sql,args)).rows;
const profile = (id="player-existing", name="Treinador") => query("select public.sync_trainer_ranking_profile($1,$2,'avatar-01')",[id,name]);
const submit = async (id="match-001", player="player-existing", mode="CPU", result="WIN", opponent=null) => (await query("select public.submit_competitive_result($1,$2,$3,$4,$5,now()) value",[id,player,mode,result,opponent]))[0].value;
const stats = async (id="player-existing") => (await query("select * from public.public_trainer_ranking where player_id=$1",[id]))[0];
const ownAll = (id="player-existing") => query("update public.badges set owner_player_id=$1,owner_display_name='Treinador',status='OWNED',claimed_at=now()",[id]);
async function rejects(action, pattern) {
  await db.exec("savepoint invalid_input");
  try { await assert.rejects(action,pattern); } finally { await db.exec("rollback to savepoint invalid_input"); }
}

before(async () => { db=await createRankingTestDatabase(); });
beforeEach(() => db.exec("begin"));
afterEach(() => db.exec("rollback"));
after(() => db.close());

test("existing identity baseline and canonical badge/rule contracts", async () => {
  const s=await stats(); assert.equal(s.display_name,"Perfil antigo"); assert.equal(s.total_battles,0); assert.equal(s.wins,0);
  const c=(await query("select config from public.competitive_ranking_rules"))[0].config;
  assert.deepEqual(c.badge_codes,BADGE_CONFIG.map(b=>b.code)); assert.equal(c.master_bonus,POKEMON_MASTER_BONUS_COINS);
  assert.deepEqual(c.master_modes,["CPU","PVP","JOURNEY"]); assert.equal(c.master_victory_only,false);
});

test("same match, refresh, reconnect and duplicate effects leave one permanent result and bonus", async () => {
  await ownAll(); const first=await submit(); assert.equal(first.accepted,true); assert.equal(first.receipt.amount,1500);
  for (let i=0;i<6;i++) { const duplicate=await submit(); assert.equal(duplicate.duplicate,true); assert.equal(duplicate.receipt.id,first.receipt.id); }
  assert.equal((await stats()).total_battles,1);
  assert.equal((await query("select count(*) n from public.competitive_reward_receipts"))[0].n,1);
  await rejects(()=>submit("match-001","player-existing","CPU","LOSS"),/Conflicting/);
});

test("CPU and Journey wins and losses award master bonus; PvP has independent per-player stats", async () => {
  await ownAll(); await profile("player-opponent");
  for (const mode of ["CPU","JOURNEY","PVP"]) for (const result of ["WIN","LOSS"]) {
    const r=await submit(`match-${mode}-${result}`,undefined,mode,result,mode==="PVP"?"player-opponent":null); assert.equal(r.receipt.amount,1500);
  }
  await submit("match-PVP-WIN","player-opponent","PVP","LOSS","player-existing");
  const s=await stats(); assert.equal(s.total_battles,6); assert.equal(s.wins,3); assert.equal(s.losses,3);
  assert.equal(s.cpu_battles,2); assert.equal(s.pvp_wins,1); assert.equal(s.journey_wins,1); assert.equal(s.current_win_streak,0);
  assert.equal((await stats("player-opponent")).pvp_losses,1);
});

test("badge transfer removes title and bonus at settlement and recovery restores it", async () => {
  await ownAll(); assert.equal((await stats()).title,"MESTRE POKÉMON");
  await profile("player-other"); await query("update public.badges set owner_player_id='player-other' where code='fire'");
  assert.equal((await stats()).badges_current,17); assert.equal((await stats()).title,null);
  assert.equal((await submit()).receipt,null);
  await query("update public.badges set owner_player_id='player-existing' where code='fire'");
  assert.equal((await stats()).title,"MESTRE POKÉMON"); assert.equal((await submit("match-restored")).receipt.amount,1500);
  // A duplicate previously ineligible result is never reevaluated into a new reward.
  assert.equal((await submit()).receipt,null);
});

test("historical badge defenses survive ownership transfer", async () => {
  await ownAll(); await query("insert into public.badge_history(badge_id,event_type,new_owner_player_id) select id,'DEFENSE','player-existing' from public.badges where code='fire'");
  assert.equal((await stats()).badge_defenses,1);
  await query("update public.badges set owner_player_id=null,owner_display_name=null,claimed_at=null,status='AVAILABLE',defense_count=0 where code='fire'");
  assert.equal((await stats()).badge_defenses,1); assert.equal((await stats()).badges_earned_lifetime,18);
});

test("invalid enums, null combinations and identities cannot change stats", async () => {
  for (const args of [[null], [""], ["bad id"], ["match-ok","bad id"], ["match-ok",undefined,"INVALID"], ["match-ok",undefined,"CPU","DRAW"], ["match-ok",undefined,"PVP"], ["match-ok",undefined,"CPU","WIN","player-other"], ["match-ok",undefined,"TOURNAMENT"], ["match-ok",undefined,"BADGE"]]) await rejects(()=>submit(...args));
  assert.equal((await stats()).total_battles,0);
  await rejects(()=>profile("bad id"));
});

test("ranking pagination, podium, current position and public schema use stable tie breakers", async () => {
  for (let i=0;i<31;i++) await profile(`player-${String(i).padStart(3,"0")}`,`Treinador ${i}`);
  const first=(await query("select public.get_trainer_ranking('player-existing',3,10) r"))[0].r;
  assert.equal(first.top3.length,3); assert.equal(first.rows.length,10); assert.equal(first.rows[0].position,4); assert.equal(first.nextOffset,13);
  assert.equal(first.current.position,32);
  const second=(await query("select public.get_trainer_ranking('player-existing',13,10) r"))[0].r;
  assert.equal(second.rows[0].position,14); assert.notEqual(first.rows[0].player_id,second.rows[0].player_id);
  const detail=(await query("select public.get_public_trainer('player-existing') r"))[0].r;
  assert.equal(detail.position,32); assert.equal(detail.avatar_id,"avatar-01"); assert.equal(detail.win_rate,0);
  for (const key of ["inventory","team","room","collection","session_id"]) assert.ok(!(key in detail));
  await rejects(()=>query("select public.get_trainer_ranking(null,-1,1000)"));
});

test("CPU cap and smoothed competitive rate do not reward unlimited raw volume", async () => {
  await profile("player-cpu"); await profile("player-pvp"); await profile("player-new");
  // Use the actual score function with valid constructed stats; no UI copy of the formula.
  await query("update public.competitive_trainer_stats set cpu_wins=100,cpu_battles=100,wins=100,total_battles=100,best_win_streak=10 where player_id='player-cpu'");
  let power=(await query("select public.calculate_trainer_power(s) p from public.competitive_trainer_stats s where player_id='player-cpu'"))[0].p;
  assert.equal(power,700);
  await query("update public.competitive_trainer_stats set cpu_wins=100000,cpu_battles=100000,wins=100000,total_battles=100000 where player_id='player-cpu'");
  assert.equal((await query("select public.calculate_trainer_power(s) p from public.competitive_trainer_stats s where player_id='player-cpu'"))[0].p,power);
  await query("update public.competitive_trainer_stats set pvp_wins=100,pvp_losses=20,pvp_battles=120,wins=100,losses=20,total_battles=120 where player_id='player-pvp'");
  await query("update public.competitive_trainer_stats set pvp_wins=1,pvp_battles=1,wins=1,total_battles=1 where player_id='player-new'");
  const p=(await query("select public.calculate_trainer_power(s) power,player_id from public.competitive_trainer_stats s where player_id in ('player-pvp','player-new') order by power desc"));
  assert.equal(p[0].player_id,"player-pvp"); assert.ok(p[1].power<100); assert.ok(p[0].power>6000);
});

test("normal clients cannot update aggregates, inspect ledgers or execute internal helpers", async () => {
  await db.exec("set local role anon");
  assert.ok((await query("select * from public.public_trainer_ranking")).length);
  for (const sql of ["update public.competitive_trainer_stats set wins=999999", "select * from public.competitive_reward_receipts", "select public.refresh_trainer_badge_stats('player-existing')", "select public.settle_competitive_result('fake-id','player-existing','CPU','WIN',null,now())"]) {
    // A savepoint keeps this transaction usable after an expected permission error.
    await db.exec("savepoint denied"); await assert.rejects(()=>db.exec(sql),/permission denied/); await db.exec("rollback to savepoint denied");
  }
});

test("profile name/avatar synchronization retains the same public identity", async () => {
  await query("select public.sync_trainer_ranking_profile('player-existing','Novo nome','avatar-09')");
  assert.equal((await stats()).display_name,"Novo nome"); assert.equal((await stats()).avatar_id,"avatar-09");
  assert.equal((await query("select count(*) n from public.competitive_players"))[0].n,1);
});

test("canonical tournament completion updates both players once and never awards master bonus", async () => {
  await ownAll(); await profile("player-other");
  const t=(await query("insert into public.tournaments(code,status,created_by_player_id) values('PKC-0001','FINAL','player-existing') returning id"))[0].id;
  await query("insert into public.tournament_players(tournament_id,player_id,display_name,slot) values($1,'player-existing','Treinador',1),($1,'player-other','Outro',2)",[t]);
  const m=(await query("insert into public.tournament_matches(tournament_id,round,round_index,player1_id,player2_id,status,battle_room_code) values($1,'FINAL',1,'player-existing','player-other','PLAYING','PKT-TEST-F') returning id",[t]))[0].id;
  await query("select public.finish_tournament_final($1,'player-existing')",[m]); await query("select public.finish_tournament_final($1,'player-existing')",[m]);
  let s=await stats(); assert.equal(s.tournament_entries,1); assert.equal(s.tournament_wins,1); assert.equal(s.tournament_finals,1); assert.equal(s.total_battles,1);
  assert.equal((await stats("player-other")).tournament_finals,1); assert.equal((await stats("player-other")).losses,1);
  assert.equal((await query("select count(*) n from public.competitive_reward_receipts"))[0].n,0);
});

test("three-battle Badge Challenge feeds stats through its canonical RPC without bonus", async () => {
  const challenge=(await query("select public.start_badge_challenge('fire','player-existing','Treinador') r"))[0].r;
  for (let i=1;i<=3;i++) await query("select public.record_badge_battle_result($1,$2,'player-existing')",[challenge.id,`badge-match-${i}`]);
  assert.equal((await stats()).badges_current,1); assert.equal((await stats()).total_battles,3);
  assert.equal((await query("select count(*) n from public.competitive_reward_receipts"))[0].n,0);
  const row=(await query("select * from public.badge_challenges where id=$1",[challenge.id]))[0]; assert.equal(row.wins_required,3); assert.equal(row.status,"COMPLETED");
});

test("every numeric tie breaker precedes the stable player ID", async()=>{
  for (const id of ["player-a","player-b","player-c","player-d","player-e"]) await profile(id);
  await query("update public.competitive_trainer_stats set trainer_power=100 where player_id <> 'player-existing'");
  await query("update public.competitive_trainer_stats set pvp_battles=1,pvp_wins=1,total_battles=1,wins=1 where player_id='player-e'");
  await query("update public.competitive_trainer_stats set tournament_wins=1 where player_id='player-d'");
  await query("update public.competitive_trainer_stats set badge_defenses=1 where player_id='player-c'");
  await query("update public.competitive_trainer_stats set cpu_battles=1,cpu_wins=1,total_battles=1,wins=1 where player_id='player-b'");
  const ranking=(await query("select public.get_trainer_ranking(null,3,20) r"))[0].r;
  assert.deepEqual([...ranking.top3,...ranking.rows].map(row=>row.player_id),["player-e","player-d","player-c","player-b","player-a","player-existing"]);
});

test("canonical missing code cannot be replaced by unknown or duplicate badges",async()=>{
  await ownAll();await query("update public.badges set code='unknown' where code='fire'");
  assert.equal((await query("select public.has_pokemon_master_title('player-existing') active"))[0].active,false);
  await rejects(()=>query("update public.badges set code='water' where code='unknown'"),/unique/);
});

test("badge inactivity is released before bonus eligibility is evaluated",async()=>{
  await ownAll();await query("update public.competitive_players set last_battle_at=now()-interval '49 hours' where player_id='player-existing'");
  const result=await submit();assert.equal(result.receipt,null);assert.equal((await stats()).title,null);assert.equal((await stats()).badges_current,0);
});

test("normal public RPC accepts individual client events, honestly retaining the casual trust model",async()=>{
  await db.exec("set local role anon");
  const result=await submit("match-manual-event");assert.equal(result.accepted,true);
  // This explicitly proves that idempotency/RLS are not server-side anti-cheat.
});

test("representative PvP, CPU, tournament, Master and new-player score scenarios",async t=>{
  for(const id of ["player-pvp","player-cpu","player-tour","player-master","player-new"]) await profile(id);
  await query("update public.competitive_trainer_stats set pvp_wins=100,pvp_losses=20,pvp_battles=120,wins=100,losses=20,total_battles=120,best_win_streak=10 where player_id='player-pvp'");
  await query("update public.competitive_trainer_stats set cpu_wins=10000,cpu_battles=10000,wins=10000,total_battles=10000,best_win_streak=10000 where player_id='player-cpu'");
  await query("update public.competitive_trainer_stats set tournament_entries=12,tournament_wins=8,tournament_finals=10,tournament_battle_wins=18,tournament_battle_losses=6,tournament_battles=24,wins=18,losses=6,total_battles=24,best_win_streak=5 where player_id='player-tour'");
  await query("update public.competitive_trainer_stats set badges_current=18,badges_earned_lifetime=18,badge_defenses=12 where player_id='player-master'");
  await query("update public.competitive_trainer_stats set pvp_wins=1,pvp_battles=1,wins=1,total_battles=1,best_win_streak=1 where player_id='player-new'");
  const scores=await query("select player_id,public.calculate_trainer_power(s) power from public.competitive_trainer_stats s where player_id <> 'player-existing' order by power desc");
  t.diagnostic(JSON.stringify(scores));
  assert.equal(scores.find(p=>p.player_id==='player-cpu').power,700);
  assert.ok(scores.find(p=>p.player_id==='player-new').power<100);
  assert.ok(scores.find(p=>p.player_id==='player-pvp').power>scores.find(p=>p.player_id==='player-master').power);
});
