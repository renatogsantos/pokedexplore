-- New Badge Challenges require three consecutive wins. Completed history is
-- intentionally untouched; only in-progress legacy series with fewer than
-- three wins are normalized to the new rule.
alter table public.badge_challenges drop constraint if exists badge_challenges_wins_required_check;
alter table public.badge_challenges add constraint badge_challenges_wins_required_check check (wins_required in (3, 4));
alter table public.badge_challenges alter column wins_required set default 3;

update public.badge_challenges
set wins_required = 3,
    current_battle = least(current_battle, 3)
where status in ('PENDING_ACCEPTANCE', 'ACTIVE')
  and wins_required = 4
  and challenger_wins < 3;

-- Active legacy records already at 3/4 stay on their historical contract.
-- They are not auto-completed or transferred by this migration.

create or replace function public.record_badge_battle_result(
  p_challenge_id uuid, p_battle_id text, p_winner_player_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_challenge public.badge_challenges%rowtype;
  current_badge public.badges%rowtype;
  refreshed_badge public.badges%rowtype;
  inserted_count integer;
  next_wins integer;
  challenger_won boolean;
begin
  perform public.release_expired_badge_state();
  select * into current_challenge from public.badge_challenges where id = p_challenge_id for update;
  if not found then raise exception using errcode = 'PB004', message = 'Desafio nao encontrado'; end if;
  select * into current_badge from public.badges where id = current_challenge.badge_id for update;
  if current_challenge.status not in ('PENDING_ACCEPTANCE', 'ACTIVE') then return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(current_badge), 'duplicate', true); end if;
  if current_challenge.expires_at <= now() then raise exception using errcode = 'PB004', message = 'Desafio expirado'; end if;
  if current_challenge.challenge_kind = 'PVP_TAKEOVER' and current_badge.owner_player_id <> current_challenge.defender_player_id then raise exception using errcode = 'PB005', message = 'Campeao alterado'; end if;
  challenger_won := p_winner_player_id = current_challenge.challenger_player_id;
  if not challenger_won and not ((current_challenge.challenge_kind = 'INITIAL_CPU' and upper(p_winner_player_id) = 'CPU') or p_winner_player_id = current_challenge.defender_player_id) then raise exception using errcode = 'PB006', message = 'Vencedor invalido'; end if;

  insert into public.badge_challenge_battles(challenge_id, battle_id, battle_number, winner_player_id) values (current_challenge.id, p_battle_id, current_challenge.current_battle, p_winner_player_id) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(current_badge), 'duplicate', true); end if;
  insert into public.competitive_battle_activity(battle_id, player_id, battle_mode) values (p_battle_id, current_challenge.challenger_player_id, case when current_challenge.challenge_kind = 'INITIAL_CPU' then 'BADGE_CPU' else 'BADGE_PVP' end) on conflict do nothing;
  update public.competitive_players set last_battle_at = now() where player_id = current_challenge.challenger_player_id;
  if current_challenge.defender_player_id is not null then
    insert into public.competitive_battle_activity(battle_id, player_id, battle_mode) values (p_battle_id, current_challenge.defender_player_id, 'BADGE_PVP') on conflict do nothing;
    update public.competitive_players set last_battle_at = now() where player_id = current_challenge.defender_player_id;
  end if;

  if challenger_won then
    next_wins := current_challenge.challenger_wins + 1;
    if next_wins >= current_challenge.wins_required then
      update public.badge_challenges set status = 'COMPLETED', challenger_wins = next_wins, completed_at = now(), winner_player_id = current_challenge.challenger_player_id where id = current_challenge.id;
      update public.badges set owner_player_id = current_challenge.challenger_player_id, owner_display_name = current_challenge.challenger_name, status = 'OWNED', claimed_at = now(), defense_count = 0 where id = current_badge.id;
      insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, new_owner_player_id, new_owner_name, challenge_id, metadata) values (current_badge.id, case when current_badge.owner_player_id is null then 'INITIAL_CLAIM' else 'TRANSFER' end, current_badge.owner_player_id, current_badge.owner_display_name, current_challenge.challenger_player_id, current_challenge.challenger_name, current_challenge.id, jsonb_build_object('score', concat(next_wins, '-0'), 'wins_required', current_challenge.wins_required));
      insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, new_owner_player_id, new_owner_name, challenge_id) values (current_badge.id, 'CHALLENGE_COMPLETED', current_badge.owner_player_id, current_badge.owner_display_name, current_challenge.challenger_player_id, current_challenge.challenger_name, current_challenge.id);
    else
      update public.badge_challenges set challenger_wins = next_wins, current_battle = next_wins + 1, status = 'ACTIVE' where id = current_challenge.id;
    end if;
  else
    update public.badge_challenges set status = 'FAILED', completed_at = now(), winner_player_id = current_challenge.defender_player_id where id = current_challenge.id;
    if current_challenge.challenge_kind = 'PVP_TAKEOVER' then
      update public.badges set status = 'OWNED', defense_count = defense_count + 1 where id = current_badge.id;
      insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, new_owner_player_id, new_owner_name, challenge_id, metadata) values (current_badge.id, 'DEFENSE', current_badge.owner_player_id, current_badge.owner_display_name, current_badge.owner_player_id, current_badge.owner_display_name, current_challenge.id, jsonb_build_object('challengerWins', current_challenge.challenger_wins));
    else
      update public.badges set status = 'AVAILABLE' where id = current_badge.id;
      insert into public.badge_history(badge_id, event_type, challenge_id, metadata) values (current_badge.id, 'CHALLENGE_FAILED', current_challenge.id, jsonb_build_object('challengerWins', current_challenge.challenger_wins));
    end if;
  end if;
  select * into current_challenge from public.badge_challenges where id = p_challenge_id;
  select * into refreshed_badge from public.badges where id = current_challenge.badge_id;
  return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(refreshed_badge), 'duplicate', false);
end;
$$;
