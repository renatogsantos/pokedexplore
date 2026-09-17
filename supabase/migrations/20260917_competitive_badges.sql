-- Shared competitive Badge System. Personal collection/economy data remains in IndexedDB.
create table if not exists public.competitive_players (
  player_id text primary key,
  display_name text not null check (char_length(display_name) between 1 and 18),
  last_battle_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null unique,
  sort_order smallint not null unique check (sort_order between 1 and 18),
  owner_player_id text,
  owner_display_name text,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'OWNED', 'CHALLENGED')),
  claimed_at timestamptz,
  defense_count integer not null default 0 check (defense_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badges_owner_player_id_fkey foreign key (owner_player_id) references public.competitive_players(player_id) on delete set null,
  constraint badges_owner_shape check (
    (owner_player_id is null and owner_display_name is null and claimed_at is null and status in ('AVAILABLE', 'CHALLENGED'))
    or
    (owner_player_id is not null and owner_display_name is not null and claimed_at is not null and status in ('OWNED', 'CHALLENGED'))
  )
);

create table if not exists public.badge_challenges (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badges(id) on delete cascade,
  challenger_player_id text not null references public.competitive_players(player_id),
  challenger_name text not null check (char_length(challenger_name) between 1 and 18),
  defender_player_id text references public.competitive_players(player_id),
  defender_name text not null,
  challenge_kind text not null check (challenge_kind in ('INITIAL_CPU', 'PVP_TAKEOVER')),
  status text not null default 'ACTIVE' check (status in ('PENDING_ACCEPTANCE', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED')),
  wins_required smallint not null default 4 check (wins_required = 4),
  challenger_wins smallint not null default 0 check (challenger_wins between 0 and 4),
  current_battle smallint not null default 1 check (current_battle between 1 and 4),
  battle_room_code text not null unique,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  completed_at timestamptz,
  winner_player_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_challenge_participants check (
    (challenge_kind = 'INITIAL_CPU' and defender_player_id is null)
    or
    (challenge_kind = 'PVP_TAKEOVER' and defender_player_id is not null and defender_player_id <> challenger_player_id)
  )
);

create unique index if not exists badge_one_active_challenge_idx
  on public.badge_challenges (badge_id)
  where status in ('PENDING_ACCEPTANCE', 'ACTIVE');
create index if not exists badge_challenges_challenger_idx on public.badge_challenges(challenger_player_id, status);
create index if not exists badge_challenges_defender_idx on public.badge_challenges(defender_player_id, status);
create index if not exists badge_challenges_expiration_idx on public.badge_challenges(expires_at) where status in ('PENDING_ACCEPTANCE', 'ACTIVE');
create index if not exists badges_owner_idx on public.badges(owner_player_id) where owner_player_id is not null;

create table if not exists public.badge_challenge_battles (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.badge_challenges(id) on delete cascade,
  battle_id text not null,
  battle_number smallint not null check (battle_number between 1 and 4),
  winner_player_id text not null,
  completed_at timestamptz not null default now(),
  unique(challenge_id, battle_id),
  unique(challenge_id, battle_number)
);

create table if not exists public.competitive_battle_activity (
  battle_id text not null,
  player_id text not null references public.competitive_players(player_id) on delete cascade,
  battle_mode text not null check (battle_mode in ('CPU', 'FRIEND', 'PVP', 'TOURNAMENT', 'BADGE_CPU', 'BADGE_PVP')),
  completed_at timestamptz not null default now(),
  primary key (battle_id, player_id)
);
create index if not exists competitive_activity_player_idx on public.competitive_battle_activity(player_id, completed_at desc);

create table if not exists public.badge_history (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badges(id) on delete cascade,
  event_type text not null check (event_type in ('INITIAL_CLAIM', 'TRANSFER', 'DEFENSE', 'RELEASED_INACTIVITY', 'CHALLENGE_STARTED', 'CHALLENGE_FAILED', 'CHALLENGE_COMPLETED')),
  previous_owner_player_id text,
  previous_owner_name text,
  new_owner_player_id text,
  new_owner_name text,
  challenge_id uuid references public.badge_challenges(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists badge_history_badge_idx on public.badge_history(badge_id, created_at desc);

insert into public.badges(code, type, sort_order)
values
  ('normal', 'normal', 1), ('fire', 'fire', 2), ('water', 'water', 3),
  ('electric', 'electric', 4), ('grass', 'grass', 5), ('ice', 'ice', 6),
  ('fighting', 'fighting', 7), ('poison', 'poison', 8), ('ground', 'ground', 9),
  ('flying', 'flying', 10), ('psychic', 'psychic', 11), ('bug', 'bug', 12),
  ('rock', 'rock', 13), ('ghost', 'ghost', 14), ('dragon', 'dragon', 15),
  ('dark', 'dark', 16), ('steel', 'steel', 17), ('fairy', 'fairy', 18)
on conflict (code) do nothing;

create or replace function public.set_badge_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists competitive_players_updated_at on public.competitive_players;
create trigger competitive_players_updated_at before update on public.competitive_players
for each row execute function public.set_badge_updated_at();
drop trigger if exists badges_updated_at on public.badges;
create trigger badges_updated_at before update on public.badges
for each row execute function public.set_badge_updated_at();
drop trigger if exists badge_challenges_updated_at on public.badge_challenges;
create trigger badge_challenges_updated_at before update on public.badge_challenges
for each row execute function public.set_badge_updated_at();

create or replace function public.register_competitive_player(p_player_id text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare current_player public.competitive_players%rowtype;
begin
  if nullif(trim(p_player_id), '') is null then raise exception using errcode = 'PB006', message = 'Identidade local invalida'; end if;
  insert into public.competitive_players(player_id, display_name)
  values (p_player_id, left(coalesce(nullif(trim(p_display_name), ''), 'Treinador'), 18))
  on conflict (player_id) do update set display_name = excluded.display_name;
  select * into current_player from public.competitive_players where player_id = p_player_id;
  return to_jsonb(current_player);
end;
$$;

create or replace function public.record_competitive_battle_activity(
  p_battle_id text, p_player_id text, p_display_name text, p_battle_mode text
) returns boolean language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
  perform public.register_competitive_player(p_player_id, p_display_name);
  insert into public.competitive_battle_activity(battle_id, player_id, battle_mode)
  values (p_battle_id, p_player_id, upper(p_battle_mode)) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    update public.competitive_players set last_battle_at = now() where player_id = p_player_id;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.release_expired_badge_state()
returns integer language plpgsql security definer set search_path = public as $$
declare
  current_challenge public.badge_challenges%rowtype;
  released record;
  changed_count integer := 0;
begin
  for current_challenge in
    select * from public.badge_challenges
    where status in ('PENDING_ACCEPTANCE', 'ACTIVE') and expires_at <= now()
    order by expires_at for update skip locked
  loop
    update public.badge_challenges set status = 'EXPIRED', completed_at = now() where id = current_challenge.id;
    update public.badges
      set status = case when owner_player_id is null then 'AVAILABLE' else 'OWNED' end
      where id = current_challenge.badge_id and status = 'CHALLENGED';
    insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, challenge_id, metadata)
    select id, 'CHALLENGE_FAILED', owner_player_id, owner_display_name, current_challenge.id, jsonb_build_object('reason', 'EXPIRED')
    from public.badges where id = current_challenge.badge_id;
    changed_count := changed_count + 1;
  end loop;

  for released in
    select badge.* from public.badges badge
    join public.competitive_players player on player.player_id = badge.owner_player_id
    where badge.owner_player_id is not null
      and player.last_battle_at is not null
      and player.last_battle_at <= now() - interval '48 hours'
      and not exists (
        select 1 from public.badge_challenges challenge
        where challenge.badge_id = badge.id and challenge.status in ('PENDING_ACCEPTANCE', 'ACTIVE')
      )
    order by badge.sort_order for update of badge skip locked
  loop
    update public.badges set owner_player_id = null, owner_display_name = null, status = 'AVAILABLE', claimed_at = null, defense_count = 0 where id = released.id;
    insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, metadata)
    values (released.id, 'RELEASED_INACTIVITY', released.owner_player_id, released.owner_display_name, jsonb_build_object('inactivityHours', 48));
    changed_count := changed_count + 1;
  end loop;
  return changed_count;
end;
$$;

create or replace function public.start_badge_challenge(
  p_badge_code text, p_challenger_player_id text, p_challenger_name text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_badge public.badges%rowtype;
  challenge_id uuid := gen_random_uuid();
  challenge_kind text;
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
  insert into public.badge_challenges(
    id, badge_id, challenger_player_id, challenger_name, defender_player_id, defender_name,
    challenge_kind, status, battle_room_code
  ) values (
    challenge_id, current_badge.id, p_challenger_player_id, left(trim(p_challenger_name), 18),
    current_badge.owner_player_id,
    coalesce(current_badge.owner_display_name, 'Lider ' || initcap(current_badge.type)),
    challenge_kind, 'ACTIVE', 'PKB-' || upper(left(replace(challenge_id::text, '-', ''), 8))
  ) returning * into current_challenge;
  update public.badges set status = 'CHALLENGED' where id = current_badge.id;
  insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, challenge_id, metadata)
  values (current_badge.id, 'CHALLENGE_STARTED', current_badge.owner_player_id, current_badge.owner_display_name, challenge_id, jsonb_build_object('kind', challenge_kind));
  return to_jsonb(current_challenge);
end;
$$;

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
  if current_challenge.status not in ('PENDING_ACCEPTANCE', 'ACTIVE') then
    return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(current_badge), 'duplicate', true);
  end if;
  if current_challenge.expires_at <= now() then raise exception using errcode = 'PB004', message = 'Desafio expirado'; end if;
  if current_challenge.challenge_kind = 'PVP_TAKEOVER' and current_badge.owner_player_id <> current_challenge.defender_player_id then
    raise exception using errcode = 'PB005', message = 'Campeao alterado';
  end if;
  challenger_won := p_winner_player_id = current_challenge.challenger_player_id;
  if not challenger_won and not (
    (current_challenge.challenge_kind = 'INITIAL_CPU' and upper(p_winner_player_id) = 'CPU')
    or p_winner_player_id = current_challenge.defender_player_id
  ) then raise exception using errcode = 'PB006', message = 'Vencedor invalido'; end if;

  insert into public.badge_challenge_battles(challenge_id, battle_id, battle_number, winner_player_id)
  values (current_challenge.id, p_battle_id, current_challenge.current_battle, p_winner_player_id)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(current_badge), 'duplicate', true);
  end if;

  insert into public.competitive_battle_activity(battle_id, player_id, battle_mode)
  values (p_battle_id, current_challenge.challenger_player_id, case when current_challenge.challenge_kind = 'INITIAL_CPU' then 'BADGE_CPU' else 'BADGE_PVP' end)
  on conflict do nothing;
  update public.competitive_players set last_battle_at = now() where player_id = current_challenge.challenger_player_id;
  if current_challenge.defender_player_id is not null then
    insert into public.competitive_battle_activity(battle_id, player_id, battle_mode)
    values (p_battle_id, current_challenge.defender_player_id, 'BADGE_PVP') on conflict do nothing;
    update public.competitive_players set last_battle_at = now() where player_id = current_challenge.defender_player_id;
  end if;

  if challenger_won then
    next_wins := current_challenge.challenger_wins + 1;
    if next_wins >= current_challenge.wins_required then
      update public.badge_challenges set status = 'COMPLETED', challenger_wins = next_wins, current_battle = 4, completed_at = now(), winner_player_id = current_challenge.challenger_player_id where id = current_challenge.id;
      update public.badges set owner_player_id = current_challenge.challenger_player_id, owner_display_name = current_challenge.challenger_name, status = 'OWNED', claimed_at = now(), defense_count = 0 where id = current_badge.id;
      insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, new_owner_player_id, new_owner_name, challenge_id, metadata)
      values (
        current_badge.id,
        case when current_badge.owner_player_id is null then 'INITIAL_CLAIM' else 'TRANSFER' end,
        current_badge.owner_player_id, current_badge.owner_display_name,
        current_challenge.challenger_player_id, current_challenge.challenger_name,
        current_challenge.id, jsonb_build_object('score', '4-0')
      );
      insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, new_owner_player_id, new_owner_name, challenge_id)
      values (current_badge.id, 'CHALLENGE_COMPLETED', current_badge.owner_player_id, current_badge.owner_display_name, current_challenge.challenger_player_id, current_challenge.challenger_name, current_challenge.id);
    else
      update public.badge_challenges set challenger_wins = next_wins, current_battle = next_wins + 1, status = 'ACTIVE' where id = current_challenge.id;
    end if;
  else
    update public.badge_challenges set status = 'FAILED', completed_at = now(), winner_player_id = current_challenge.defender_player_id where id = current_challenge.id;
    if current_challenge.challenge_kind = 'PVP_TAKEOVER' then
      update public.badges set status = 'OWNED', defense_count = defense_count + 1 where id = current_badge.id;
      insert into public.badge_history(badge_id, event_type, previous_owner_player_id, previous_owner_name, new_owner_player_id, new_owner_name, challenge_id, metadata)
      values (current_badge.id, 'DEFENSE', current_badge.owner_player_id, current_badge.owner_display_name, current_badge.owner_player_id, current_badge.owner_display_name, current_challenge.id, jsonb_build_object('challengerWins', current_challenge.challenger_wins));
    else
      update public.badges set status = 'AVAILABLE' where id = current_badge.id;
      insert into public.badge_history(badge_id, event_type, challenge_id, metadata)
      values (current_badge.id, 'CHALLENGE_FAILED', current_challenge.id, jsonb_build_object('challengerWins', current_challenge.challenger_wins));
    end if;
  end if;
  select * into current_challenge from public.badge_challenges where id = p_challenge_id;
  select * into refreshed_badge from public.badges where id = current_challenge.badge_id;
  return to_jsonb(current_challenge) || jsonb_build_object('badge', to_jsonb(refreshed_badge), 'duplicate', false);
end;
$$;

alter table public.competitive_players enable row level security;
alter table public.badges enable row level security;
alter table public.badge_challenges enable row level security;
alter table public.badge_challenge_battles enable row level security;
alter table public.competitive_battle_activity enable row level security;
alter table public.badge_history enable row level security;

drop policy if exists "competitive players public read" on public.competitive_players;
create policy "competitive players public read" on public.competitive_players for select using (true);
drop policy if exists "badges public read" on public.badges;
create policy "badges public read" on public.badges for select using (true);
drop policy if exists "badge challenges public read" on public.badge_challenges;
create policy "badge challenges public read" on public.badge_challenges for select using (true);
drop policy if exists "badge history public read" on public.badge_history;
create policy "badge history public read" on public.badge_history for select using (true);

grant select on public.competitive_players, public.badges, public.badge_challenges, public.badge_history to anon, authenticated;
revoke insert, update, delete on public.competitive_players, public.badges, public.badge_challenges, public.badge_challenge_battles, public.competitive_battle_activity, public.badge_history from anon, authenticated;
grant execute on function public.register_competitive_player(text, text) to anon, authenticated;
grant execute on function public.record_competitive_battle_activity(text, text, text, text) to anon, authenticated;
grant execute on function public.release_expired_badge_state() to anon, authenticated;
grant execute on function public.start_badge_challenge(text, text, text) to anon, authenticated;
grant execute on function public.record_badge_battle_result(uuid, text, text) to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'badges') then
    alter publication supabase_realtime add table public.badges;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'badge_challenges') then
    alter publication supabase_realtime add table public.badge_challenges;
  end if;
end $$;

-- Query-time release already makes expiration server-verifiable. When pg_cron is available,
-- this minute-level job also releases badges without requiring any client to open the app.
create extension if not exists pg_cron;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'release-expired-competitive-badges') then
    perform cron.schedule('release-expired-competitive-badges', '* * * * *', 'select public.release_expired_badge_state()');
  end if;
end $$;

