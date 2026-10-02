import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCompetitiveResult, validateCompetitiveEvent, validateMasterReceipt } from "./results.js";

const state = () => ({ matchId:"match-finished",status:"finished",winner:"host",revision:4,
  host:{id:"player-existing",team:[{hp:12}]},guest:{id:"player-opponent",team:[{hp:0}]},performance:{startedAt:Date.now()-10000,endedAt:Date.now()} });
const build = (s=state(), args={}) => buildCompetitiveResult({state:s,role:"host",playerId:"player-existing",mode:"cpu",...args});

test("natural CPU/PvP/Journey completion creates compact individual results, including losses",()=>{
  const s=state(); assert.equal(build(s).mode,"CPU"); assert.equal(build(s).result,"WIN");
  assert.equal(build(s,{journey:true}).mode,"JOURNEY");
  const pvp=build(s,{mode:"friend"}); assert.equal(pvp.mode,"PVP"); assert.equal(pvp.opponentPlayerId,"player-opponent");
  const loss=build(s,{role:"guest",playerId:"player-opponent",mode:"pvp"}); assert.equal(loss.result,"LOSS");
  assert.deepEqual(Object.keys(loss).sort(),["completedAt","matchId","mode","opponentPlayerId","playerId","result"].sort());
});
test("abandonment, disconnect, prebattle, invalid winner and unfinished team cannot submit",()=>{
  for(const patch of [{status:"playing"},{status:"countdown"},{status:"cancelled"},{abandoned:true},{cancelled:true},{forfeit:true},{revision:0},{winner:null},{winner:"bad"},{guest:{id:"player-opponent",team:[{hp:2}]}},{performance:{startedAt:null,endedAt:Date.now()}}]) assert.equal(build({...state(),...patch}),null);
  assert.equal(build(state(),{playerId:"other-player"}),null);
});
test("Tournament and Badge results are reserved for shared canonical server triggers",()=>{
  for(const mode of ["tournament","badge-cpu","badge-pvp","bad"]) assert.equal(build(state(),{mode}),null);
});
test("receipt validation rejects foreign identity, match, amount, type and malformed event",()=>{
  const event=build();const receipt={id:"00000000-0000-4000-8000-000000000001",player_id:event.playerId,match_id:event.matchId,reward_type:"POKEMON_MASTER_BATTLE_BONUS",amount:1500};
  assert.equal(validateMasterReceipt(receipt,event),true);
  for(const patch of [{id:"fake"},{player_id:"other-player"},{match_id:"other-match"},{amount:99999},{reward_type:"OTHER"}]) assert.equal(validateMasterReceipt({...receipt,...patch},event),false);
  assert.equal(validateCompetitiveEvent({...event,mode:"PVP",opponentPlayerId:null}),false);
  assert.equal(validateCompetitiveEvent({...event,result:"ABANDON"}),false);
});
