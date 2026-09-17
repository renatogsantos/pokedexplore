import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../supabase/migrations/202609170001_badge_challenge_cancellation.sql", import.meta.url);
const migration = await readFile(migrationUrl, "utf8");
const cancellation = migration.match(/create or replace function public\.cancel_badge_challenge[\s\S]+?(?=create or replace function public\.guard_badge_challenge_battle_start)/)?.[0] || "";

test("badge cancellation uses the real relationship and one atomic database function", () => {
  assert.ok(cancellation);
  assert.doesNotMatch(migration, /badges\.challenge_id/i);
  assert.match(cancellation, /badge_challenges where id = p_challenge_id for update/i);
  assert.match(cancellation, /badges where id = current_challenge\.badge_id for update/i);
  assert.match(cancellation, /challenger_player_id <> p_player_id/i);
  assert.doesNotMatch(cancellation, /delete\s+from/i);
  assert.doesNotMatch(cancellation, /insert into public\.badge_challenge_battles/i);
});

test("CPU cancellation terminates the attempt and fully releases the unowned badge", () => {
  assert.match(cancellation, /status = case when is_abandonment then 'FAILED' else 'CANCELLED' end/i);
  assert.match(cancellation, /completed_at = now\(\)/i);
  assert.match(cancellation, /challenge_kind = 'INITIAL_CPU'[\s\S]+?owner_player_id = null, owner_display_name = null, status = 'AVAILABLE', claimed_at = null, defense_count = 0/i);
});

test("PvP cancellation preserves the champion and awards a defense only after series start", () => {
  assert.match(cancellation, /is_abandonment := current_challenge\.challenge_kind = 'PVP_TAKEOVER' and current_challenge\.series_started_at is not null/i);
  assert.match(cancellation, /elsif is_abandonment then[\s\S]+?status = 'OWNED', defense_count = defense_count \+ 1/i);
  assert.match(cancellation, /else\s+update public\.badges set status = 'OWNED'/i);
  assert.match(cancellation, /cancellation_reason = 'CHALLENGER_CANCELLED'[\s\S]+?'duplicate', true/i);
  assert.match(cancellation, /cancellation_reason = 'CHALLENGER_ABANDONED'[\s\S]+?'duplicate', true/i);
});
