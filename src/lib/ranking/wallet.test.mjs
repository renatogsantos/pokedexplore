import { before, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { webStore } from "../../helpers/webStore.js";
import { calculateBattleRewards } from "../battle/rewards.js";

const storage=new Map();
const win=new EventTarget();win.indexedDB=indexedDB;win.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
before(()=>{globalThis.window=win;globalThis.IDBKeyRange=IDBKeyRange;});
const event = (matchId="match-wallet",time=Date.now()) => ({matchId,playerId:"player-existing",mode:"CPU",result:"WIN",opponentPlayerId:null,completedAt:new Date(time).toISOString()});
const response = (e=event(),id="00000000-0000-4000-8000-000000000001") => ({accepted:true,receipt:{id,match_id:e.matchId,player_id:e.playerId,reward_type:"POKEMON_MASTER_BATTLE_BONUS",amount:1500}});
async function seed() {
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("PokedExploreDB",4);r.onupgradeneeded=()=>{r.result.createObjectStore("player",{keyPath:"key"});r.result.createObjectStore("pokedex",{keyPath:"id"});r.result.createObjectStore("pokeapi-cache",{keyPath:"key"});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction("player","readwrite");const s=tx.objectStore("player");s.put({key:"trainer-profile",playerId:"player-existing",name:"Perfil antigo",avatarId:"avatar-01"});s.put({key:"economy",coins:10000,itemSystemVersion:2,durableEquipmentVersion:1,durableRepairVersion:1,inventory:{"vital-potion":99},progress:{wins:42,totalBattles:50}});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
}
beforeEach(async()=>{storage.set("PokedExploreIndexedDBMigrated","true");await seed();});
afterEach(async()=>{await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase("PokedExploreDB");r.onsuccess=resolve;r.onerror=()=>reject(r.error);});});

test("10,000 + canonical normal reward + 1,500 once across refresh/reconnect and simultaneous effects",async()=>{
  const e=event(); const r=response(e);
  const normal=calculateBattleRewards({won:true,durationMs:45000,usedOnlyOnePokemon:true});
  await webStore.rewardVictory(e.matchId,normal.total);
  await webStore.enqueueCompetitiveResult(e); await webStore.enqueueCompetitiveResult(e);
  assert.equal((await webStore.getPendingCompetitiveResults(e.playerId)).length,1);
  const results=await Promise.all(Array.from({length:8},()=>webStore.applyCompetitiveSettlement(e,r)));
  assert.equal(results.filter(result=>result.applied).length,1);
  assert.equal((await webStore.getEconomy()).coins,10000+normal.total+1500);
  assert.equal((await webStore.getEconomy()).inventory["vital-potion"],99);
  assert.equal((await webStore.getPendingCompetitiveResults(e.playerId)).length,0);
  assert.equal(await webStore.enqueueCompetitiveResult(e),false);
  assert.equal((await webStore.applyCompetitiveSettlement(e,{...r,accepted:false,duplicate:true})).applied,false);
  assert.equal((await webStore.getLocalPlayerProfile()).playerId,"player-existing");
});

test("permanent reward IDs remain effective beyond the old 100/250 receipt windows",async()=>{
  const original=event();await webStore.applyCompetitiveSettlement(original,response(original));
  for(let i=2;i<=260;i++){const e=event(`match-wallet-${i}`);await webStore.applyCompetitiveSettlement(e,response(e,`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`));}
  const before=(await webStore.getEconomy()).coins;
  assert.equal((await webStore.applyCompetitiveSettlement(original,response(original))).applied,false);
  assert.equal((await webStore.getEconomy()).coins,before);
});

test("receipt application is owner scoped and does not change another local wallet",async()=>{
  const e=event();await webStore.enqueueCompetitiveResult(e);
  await webStore.setLocalPlayerProfile({playerId:"player-other",displayName:"Outro",avatarId:"avatar-02"});
  assert.equal((await webStore.applyCompetitiveSettlement(e,response(e))).ownerChanged,true);
  assert.equal((await webStore.getEconomy()).coins,10000);
  assert.equal((await webStore.getPendingCompetitiveResults("player-other")).length,0);
  assert.equal((await webStore.getPendingCompetitiveResults(e.playerId)).length,1);
});

test("invalid receipts leave wallet and outbox untouched; ineligible accepted results apply zero",async()=>{
  const e=event();await webStore.enqueueCompetitiveResult(e);
  await assert.rejects(()=>webStore.applyCompetitiveSettlement(e,{accepted:true,receipt:{...response(e).receipt,amount:999999}}));
  assert.equal((await webStore.getEconomy()).coins,10000);
  assert.equal((await webStore.getPendingCompetitiveResults(e.playerId)).length,1);
  const zero=await webStore.applyCompetitiveSettlement(e,{accepted:true,receipt:null});assert.equal(zero.applied,false);assert.equal(zero.masterBonus,0);
  assert.equal((await webStore.getPendingCompetitiveResults(e.playerId)).length,0);
});

test("offline outbox reads only this owner's pending results in completion order",async()=>{
  const now=Date.now();await webStore.enqueueCompetitiveResult(event("match-first-lex",now));await webStore.enqueueCompetitiveResult(event("match-z-last-lex",now-1000));
  const pending=await webStore.getPendingCompetitiveResults("player-existing");assert.equal(pending[0].event.matchId,"match-z-last-lex");
});

test("Master celebration only triggers on a saved inactive-to-active transition",async()=>{
  assert.equal(await webStore.recordPokemonMasterState("player-existing",true),false);
  assert.equal(await webStore.recordPokemonMasterState("player-existing",true),false);
  assert.equal(await webStore.recordPokemonMasterState("player-existing",false),false);
  assert.equal(await webStore.recordPokemonMasterState("player-existing",true),true);
  assert.equal(await webStore.recordPokemonMasterState("player-existing",true),false);
});
