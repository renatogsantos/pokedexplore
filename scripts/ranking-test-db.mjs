// Isolated PostgreSQL/WASM test database; never connects to remote Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export async function createRankingTestDatabase() {
  const db = new PGlite();
  const migration = async file => (await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url),"utf8")).replace(/\r\n/g,"\n");
  await db.exec("create role anon; create role authenticated; create publication supabase_realtime;");
  for(const file of ["20260908_create_tournaments.sql","20260924_tournament_player_avatars.sql","20260929_hybrid_tournaments.sql"]) await db.exec(await migration(file));
  let badges=await migration("20260917_competitive_badges.sql");
  // pg_cron and hosted Realtime infrastructure are outside this embedded test DB.
  badges=badges.slice(0,badges.indexOf("do $$ begin\n  if not exists (select 1 from pg_publication_tables"));
  await db.exec(badges);
  for(const file of ["202609170001_badge_challenge_cancellation.sql","20260928_badge_challenge_three_wins.sql","20260908_finalize_tournament.sql","20260930_complete_tournament_semifinal.sql"]) await db.exec(await migration(file));
  await db.exec("insert into public.competitive_players(player_id,display_name) values('player-existing','Perfil antigo')");
  await db.exec(await migration("20261002_trainer_ranking.sql"));
  return db;
}
