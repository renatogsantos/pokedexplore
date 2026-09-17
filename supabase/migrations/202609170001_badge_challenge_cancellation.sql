-- Explicit, atomic cancellation and abandonment for competitive Badge Challenges.
-- Navigation never calls these functions; only an intentional player action does.

alter table public.badge_challenges
  add column if not exists accepted_at timestamptz,
  add column if not exists series_started_at timestamptz,
  add column if not exists cancellation_reason text;

-- Preserve known legacy progress. A completed battle proves that the official series started.
update public.badge_challenges challenge
set
  accepted_at = coalesce(challenge.accepted_at, challenge.started_at),
  series_started_at = coalesce(
    challenge.series_started_at,
    (select min(battle.completed_at) from public.badge_challenge_battles battle where battle.challenge_id = challenge.id)
  )
where challenge.challenge_kind = 'PVP_TAKEOVER'
  and exists (select 1 from public.badge_challenge_battles battle where battle.challenge_id = challenge.id);

-- Challenges created by the earlier migration had no explicit acceptance state. If no official
-- battle exists, return them to the waiting state so the champion can accept them deliberately.
update public.badge_challenges
set status = 'PENDING_ACCEPTANCE'
where challenge_kind = 'PVP_TAKEOVER'
  and status = 'ACTIVE'
  and accepted_at is null
  and series_started_at is null;

create or replace function public.start_badge_challenge(
  p_badge_code text, p_challenger_player_id text, p_challenger_name text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_badge public.badges%rowtype;
  challenge_id uuid := gen_random_uuid();
  challenge_kind text;
  challenge_status text;
  current_challenge public.badge_challenges%rowtype;
begin
  perform public.release_expired_badge_state();
  perform public.register_competitive_player(p_challenger_player_id, p_challenger_name);
  select * into current_badge from public.badges where code = lower(p_badge_code) for update;
  if not found then raise exception using errcode = 'PB001', message = 'Insignia nao encontrada'; end if;
  if current_badge.owner_player_id = p_challenger_player_id then raise exception using errcode = 'PB003', message = 'Auto desafio invalido'; end if;
  if exists (select 1 from public.badge_challenges where badge_id = current_badge.id and status in ('PENDING_ACCEPTANCE', 'ACTIVE')) then
    raise exception using errcode = 'PB002', message = 'Insignia em disputa';
  end if;

  challenge_kind := case when current_badge.owner_player_id is null then 'INITIAL_CPU' else 'PVP_TAKEOVER' end;
  challenge_status := case when challenge_kind = 'INITIAL_CPU' then 'ACTIVE' else 'PENDING_ACCEPTANCE' end;

  insert into public.badge_challenges(
    id, badge_id, challenger_player_id, challenger_name, defender_player_id, defender_name,
    challenge_kind, status, battle_room_code
  ) values (
    challenge_id, current_badge.id, p_challenger_player_id, left(trim(p_challenger_name), 18),
    current_badge.owner_player_id,
    coalesce(current_badge.owner_display_name, 'Lider ' || initcap(current_badge.type)),
    challenge_kind, challenge_status, 'PKB-' || upper(left(replace(challenge_id::text, '-', ''), 8))
  ) returning * into current_challenge;

  update public.badges set status = 'CHALLENGED' where id = current_badge.id;
  insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, challenge_id, metadata)
  values (current_badge.id, 'CHALLENGE_STARTED', current_badge.owner_player_id, current_badge.owner_display_name, challenge_id, jsonb_build_object('kind', challenge_kind));
  return to_jsonb(current_challenge);
end;
$$;

create or replace function public.accept_badge_challenge(
  p_challenge_id uuid, p_player_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_challenge public.badge_challenges%rowtype;
  current_badge public.badges%rowtype;
  was_duplicate boolean := false;
begin
  perform public.release_expired_badge_state();
  select * into current_challenge from public.badge_challenges where id = p_challenge_id for update;
  if not found then raise exception using errcode = 'PB004', message = 'Desafio nao encontrado'; end if;
  if current_challenge.challenge_kind <> 'PVP_TAKEOVER' or current_challenge.defender_player_id <> p_player_id then
    raise exception using errcode = 'PB007', message = 'Jogador nao pode aceitar este desafio';
  end if;
  select * into current_badge from public.badges where id = current_challenge.badge_id for update;
  if not found then raise exception using errcode = 'PB001', message = 'Insignia vinculada nao encontrada'; end if;
  if current_badge.owner_player_id <> current_challenge.defender_player_id or current_badge.status <> 'CHALLENGED' then
    raise exception using errcode = 'PB005', message = 'Campeao alterado';
  end if;

  if current_challenge.status = 'PENDING_ACCEPTANCE' then
    update public.badge_challenges
    set status = 'ACTIVE', accepted_at = coalesce(accepted_at, now())
    where id = current_challenge.id
    returning * into current_challenge;
  elsif current_challenge.status = 'ACTIVE' and current_challenge.accepted_at is not null then
    was_duplicate := true;
  else
    raise exception using errcode = 'PB008', message = 'Desafio nao pode mais ser aceito';
  end if;

  return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(current_badge), 'duplicate', was_duplicate);
end;
$$;

create or replace function public.mark_badge_challenge_started(
  p_challenge_id uuid, p_player_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_challenge public.badge_challenges%rowtype;
  current_badge public.badges%rowtype;
  was_duplicate boolean := false;
begin
  perform public.release_expired_badge_state();
  select * into current_challenge from public.badge_challenges where id = p_challenge_id for update;
  if not found then raise exception using errcode = 'PB004', message = 'Desafio nao encontrado'; end if;
  if current_challenge.challenge_kind <> 'PVP_TAKEOVER' or current_challenge.challenger_player_id <> p_player_id then
    raise exception using errcode = 'PB007', message = 'Jogador nao pode iniciar esta serie';
  end if;
  if current_challenge.status = 'PENDING_ACCEPTANCE' then
    raise exception using errcode = 'PB009', message = 'Campeao ainda nao aceitou';
  end if;
  if current_challenge.status <> 'ACTIVE' then
    raise exception using errcode = 'PB008', message = 'Desafio nao esta ativo';
  end if;
  select * into current_badge from public.badges where id = current_challenge.badge_id for update;
  if current_badge.owner_player_id <> current_challenge.defender_player_id or current_badge.status <> 'CHALLENGED' then
    raise exception using errcode = 'PB005', message = 'Campeao alterado';
  end if;

  if current_challenge.series_started_at is null then
    update public.badge_challenges set series_started_at = now() where id = current_challenge.id returning * into current_challenge;
  else
    was_duplicate := true;
  end if;
  return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(current_badge), 'duplicate', was_duplicate);
end;
$$;

create or replace function public.cancel_badge_challenge(
  p_challenge_id uuid, p_player_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_challenge public.badge_challenges%rowtype;
  current_badge public.badges%rowtype;
  refreshed_badge public.badges%rowtype;
  is_abandonment boolean;
  result_action text;
begin
  perform public.release_expired_badge_state();
  select * into current_challenge from public.badge_challenges where id = p_challenge_id for update;
  if not found then raise exception using errcode = 'PB004', message = 'Desafio nao encontrado'; end if;
  if current_challenge.challenger_player_id <> p_player_id then
    raise exception using errcode = 'PB007', message = 'Somente o desafiante pode encerrar esta tentativa';
  end if;
  select * into current_badge from public.badges where id = current_challenge.badge_id for update;
  if not found then raise exception using errcode = 'PB001', message = 'Insignia vinculada nao encontrada'; end if;

  if current_challenge.status = 'CANCELLED' and current_challenge.cancellation_reason = 'CHALLENGER_CANCELLED' then
    return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(current_badge), 'action', 'CANCELLED', 'duplicate', true);
  end if;
  if current_challenge.status = 'FAILED' and current_challenge.cancellation_reason = 'CHALLENGER_ABANDONED' then
    return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(current_badge), 'action', 'ABANDONED', 'duplicate', true);
  end if;
  if current_challenge.status not in ('PENDING_ACCEPTANCE', 'ACTIVE') then
    raise exception using errcode = 'PB008', message = 'Desafio nao pode mais ser encerrado';
  end if;
  if current_badge.status <> 'CHALLENGED' then
    raise exception using errcode = 'PB005', message = 'Insignia nao esta mais vinculada ao desafio';
  end if;
  if current_challenge.challenge_kind = 'INITIAL_CPU' and current_badge.owner_player_id is not null then
    raise exception using errcode = 'PB005', message = 'Proprietario da Insignia foi alterado';
  end if;
  if current_challenge.challenge_kind = 'PVP_TAKEOVER' and current_badge.owner_player_id <> current_challenge.defender_player_id then
    raise exception using errcode = 'PB005', message = 'Campeao alterado';
  end if;

  is_abandonment := current_challenge.challenge_kind = 'PVP_TAKEOVER' and current_challenge.series_started_at is not null;
  result_action := case when is_abandonment then 'ABANDONED' else 'CANCELLED' end;

  update public.badge_challenges
  set
    status = case when is_abandonment then 'FAILED' else 'CANCELLED' end,
    completed_at = now(),
    winner_player_id = case when is_abandonment then defender_player_id else null end,
    cancellation_reason = case when is_abandonment then 'CHALLENGER_ABANDONED' else 'CHALLENGER_CANCELLED' end
  where id = current_challenge.id
  returning * into current_challenge;

  if current_challenge.challenge_kind = 'INITIAL_CPU' then
    update public.badges
    set owner_player_id = null, owner_display_name = null, status = 'AVAILABLE', claimed_at = null, defense_count = 0
    where id = current_badge.id;
  elsif is_abandonment then
    update public.badges set status = 'OWNED', defense_count = defense_count + 1 where id = current_badge.id;
    insert into public.badge_history(
      badge_id, event_type, previous_owner_player_id, previous_owner_name,
      new_owner_player_id, new_owner_name, challenge_id, metadata
    ) values (
      current_badge.id, 'DEFENSE', current_badge.owner_player_id, current_badge.owner_display_name,
      current_badge.owner_player_id, current_badge.owner_display_name, current_challenge.id,
      jsonb_build_object('reason', 'CHALLENGER_ABANDONED', 'challengerWins', current_challenge.challenger_wins)
    );
  else
    update public.badges set status = 'OWNED' where id = current_badge.id;
  end if;

  select * into refreshed_badge from public.badges where id = current_challenge.badge_id;
  return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(refreshed_badge), 'action', result_action, 'duplicate', false);
end;
$$;

create or replace function public.guard_badge_challenge_battle_start()
returns trigger language plpgsql security definer set search_path = public as $$
declare challenge_status text;
begin
  select status into challenge_status from public.badge_challenges where id = new.challenge_id for update;
  if challenge_status = 'PENDING_ACCEPTANCE' then
    raise exception using errcode = 'PB009', message = 'Campeao ainda nao aceitou';
  end if;
  if challenge_status <> 'ACTIVE' then
    raise exception using errcode = 'PB008', message = 'Desafio nao esta ativo';
  end if;
  update public.badge_challenges
  set series_started_at = coalesce(series_started_at, now())
  where id = new.challenge_id and challenge_kind = 'PVP_TAKEOVER';
  return new;
end;
$$;

drop trigger if exists badge_challenge_battle_start_guard on public.badge_challenge_battles;
create trigger badge_challenge_battle_start_guard
before insert on public.badge_challenge_battles
for each row execute function public.guard_badge_challenge_battle_start();

grant execute on function public.accept_badge_challenge(uuid, text) to anon, authenticated;
grant execute on function public.mark_badge_challenge_started(uuid, text) to anon, authenticated;
grant execute on function public.cancel_badge_challenge(uuid, text) to anon, authenticated;
