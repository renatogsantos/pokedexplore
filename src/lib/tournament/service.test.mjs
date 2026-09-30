import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
const configSource = await readFile(new URL("./config.js", import.meta.url), "utf8");
globalThis.__tournamentConfigForServiceTest = await import(`data:text/javascript;base64,${Buffer.from(configSource).toString("base64")}`);
const snapshotSource = await readFile(new URL("./snapshot.js", import.meta.url), "utf8");
globalThis.__tournamentSnapshotForServiceTest = await import(`data:text/javascript;base64,${Buffer.from(snapshotSource).toString("base64")}`);
const calls = [];
const match = { id: "semi-1", tournament_id: "tournament-1", round: "SEMIFINAL", status: "PLAYING", player1_id: "a", player2_id: "b" };
let tournamentStatus = "SEMIFINALS";
globalThis.__tournamentDbForServiceTest = {
  from(table) {
    const query = {
      select() { return this; }, eq() { return this; },
      single: async () => ({ data: table === "tournament_matches" ? match : { status: tournamentStatus }, error: null }),
      maybeSingle: async () => ({ data: { id: "tournament-1", status: tournamentStatus, tournament_players: [], tournament_matches: [match] }, error: null }),
      update() { throw new Error("Semifinal must not be updated through separate client writes"); },
      insert() { throw new Error("Final must not be inserted through a separate client write"); },
    };
    return query;
  },
  async rpc(name, args) {
    calls.push({ name, args });
    if (name === "complete_tournament_semifinal") {
      match.status = "FINISHED";
      match.winner_id = args.p_winner_id;
      tournamentStatus = "FINAL";
    }
    return { error: null };
  },
};
const source = (await readFile(new URL("./service.js", import.meta.url), "utf8"))
  .replace('import { createClient } from "@supabase/supabase-js";', "const createClient = () => globalThis.__tournamentDbForServiceTest;")
  .replace(/import\s*\{[\s\S]*?\}\s*from "\.\/config";/,
    "const { MATCH_STATUS, ROUND, TOURNAMENT_CONFIG, TOURNAMENT_STATUS } = globalThis.__tournamentConfigForServiceTest;")
  .replace('import { normalizePlayerAvatarId } from "@/lib/profile/avatars";', "const normalizePlayerAvatarId = (value) => value;")
  .replace('import { normalizeTournamentSnapshot } from "./snapshot";', "const { normalizeTournamentSnapshot } = globalThis.__tournamentSnapshotForServiceTest;");
const { completeTournamentMatch } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("semifinal completion uses one atomic RPC and safely reconciles a repeated call", async () => {
  const first = await completeTournamentMatch("semi-1", "a");
  assert.equal(first.status, "FINAL");
  await completeTournamentMatch("semi-1", "a");
  assert.deepEqual(calls.map((entry) => entry.name), ["complete_tournament_semifinal", "complete_tournament_semifinal"]);
  assert.deepEqual(calls[0].args, { p_match_id: "semi-1", p_winner_id: "a" });
});
