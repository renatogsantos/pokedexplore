-- Casual/trusted-client ranking. No Auth or server-authoritative match simulation.
-- Clients send individual results, NEVER aggregate totals. Internal helpers are private.
begin;

alter table public.competitive_players add column if not exists avatar_id text not null default 'avatar-01'
  check (avatar_id ~ '^avatar-0[1-9]$');

create table public.competitive_ranking_rules (
  singleton boolean primary key default true check (singleton),
  config jsonb not null
);
-- Canonical badge codes come from the EXISTING shared Badge System, not a second type catalog.
do $$ begin
  if (select count(*) from public.badges) <> 18 then
    raise exception 'Apply the canonical 18-badge migration before ranking';
  end if;
end $$;
insert into public.competitive_ranking_rules(config) select jsonb_build_object(
  'badge_codes', jsonb_agg(code order by sort_order),
  'cpu_win', 5, 'cpu_win_cap', 100, 'journey_win', 10, 'journey_win_cap', 100,
  'pvp_win', 60, 'tournament_win', 500, 'tournament_final', 120,
  'tournament_entry', 20, 'tournament_entry_cap', 50,
  'badge_current', 250, 'badge_earned', 40, 'badge_defense', 80,
  'streak', 20, 'streak_cap', 10, 'rate_scale', 1000, 'rate_prior', 10, 'rate_sample', 20,
  'master_bonus', 1500, 'master_modes', jsonb_build_array('CPU','PVP','JOURNEY'),
  'master_victory_only', false
) from public.badges;

create table public.competitive_trainer_stats (
  player_id text primary key references public.competitive_players(player_id) on delete cascade,
  total_battles bigint not null default 0 check (total_battles >= 0),
  wins bigint not null default 0 check (wins >= 0), losses bigint not null default 0 check (losses >= 0),
  cpu_battles bigint not null default 0, cpu_wins bigint not null default 0, cpu_losses bigint not null default 0,
  pvp_battles bigint not null default 0, pvp_wins bigint not null default 0, pvp_losses bigint not null default 0,
  journey_battles bigint not null default 0, journey_wins bigint not null default 0, journey_losses bigint not null default 0,
  tournament_battles bigint not null default 0, tournament_battle_wins bigint not null default 0, tournament_battle_losses bigint not null default 0,
  badge_battles bigint not null default 0, badge_wins bigint not null default 0, badge_losses bigint not null default 0,
  tournament_entries bigint not null default 0, tournament_wins bigint not null default 0, tournament_finals bigint not null default 0,
  badges_current integer not null default 0, badges_earned_lifetime integer not null default 0, badge_defenses bigint not null default 0,
  current_win_streak bigint not null default 0, best_win_streak bigint not null default 0,
  trainer_power bigint not null default 0,
  title text check (title is null or title = 'MESTRE POKÉMON'),
  last_battle_at timestamptz, updated_at timestamptz not null default now(),
  check (wins + losses = total_battles),
  check (cpu_battles = cpu_wins + cpu_losses and pvp_battles = pvp_wins + pvp_losses
    and journey_battles = journey_wins + journey_losses and tournament_battles = tournament_battle_wins + tournament_battle_losses
    and badge_battles = badge_wins + badge_losses),
  check (total_battles = cpu_battles + pvp_battles + journey_battles + tournament_battles + badge_battles),
  check (badges_current between 0 and 18 and badges_earned_lifetime between 0 and 18),
  check (current_win_streak >= 0 and best_win_streak >= current_win_streak)
);

create table public.competitive_match_results (
  match_id text not null check (match_id ~ '^[A-Za-z0-9][A-Za-z0-9_:-]{2,159}$'),
  player_id text not null references public.competitive_players(player_id),
  mode text not null check (mode in ('CPU','PVP','JOURNEY','TOURNAMENT','BADGE')),
  result text not null check (result in ('WIN','LOSS')),
  opponent_player_id text,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id),
  check (opponent_player_id is null or opponent_player_id <> player_id),
  check (mode not in ('CPU','JOURNEY') or opponent_player_id is null),
  check (mode <> 'PVP' or opponent_player_id is not null)
);
create table public.competitive_reward_receipts (
  id uuid primary key default gen_random_uuid(),
  match_id text not null, player_id text not null,
  reward_type text not null check (reward_type = 'POKEMON_MASTER_BATTLE_BONUS'),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (match_id, player_id) references public.competitive_match_results(match_id, player_id),
  unique (match_id, player_id, reward_type)
);
create table public.competitive_tournament_receipts (
  tournament_id uuid not null references public.tournaments(id),
  player_id text not null references public.competitive_players(player_id),
  event_type text not null check (event_type in ('ENTRY','FINAL','WIN')),
  primary key (tournament_id, player_id, event_type)
);
create table public.competitive_badge_achievements (
  player_id text not null references public.competitive_players(player_id),
  badge_code text not null,
  primary key (player_id, badge_code)
);
create index badge_history_ranking_owner_idx on public.badge_history(new_owner_player_id,event_type,badge_id);
create index trainer_ranking_order_idx on public.competitive_trainer_stats
  (trainer_power desc, pvp_wins desc, tournament_wins desc, badge_defenses desc, wins desc, player_id collate "C" asc);
create index competitive_result_player_time_idx on public.competitive_match_results(player_id, created_at desc);

create function public.has_pokemon_master_title(p_player_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_player_id is not null and not exists (
    select 1 from public.competitive_ranking_rules r,
      jsonb_array_elements_text(r.config->'badge_codes') expected(code)
    where not exists (select 1 from public.badges b where b.code = expected.code and b.owner_player_id = p_player_id)
  ) and exists (select 1 from public.competitive_ranking_rules where jsonb_array_length(config->'badge_codes') > 0);
$$;

-- ONE score implementation, evaluated on the server; React only displays it.
create function public.calculate_trainer_power(s public.competitive_trainer_stats)
returns bigint language sql stable security definer set search_path = '' as $$
  select floor(
    least(s.cpu_wins, (c->>'cpu_win_cap')::bigint) * (c->>'cpu_win')::integer
    + least(s.journey_wins, (c->>'journey_win_cap')::bigint) * (c->>'journey_win')::integer
    + s.pvp_wins * (c->>'pvp_win')::integer
    + s.tournament_wins * (c->>'tournament_win')::integer
    + s.tournament_finals * (c->>'tournament_final')::integer
    + least(s.tournament_entries, (c->>'tournament_entry_cap')::bigint) * (c->>'tournament_entry')::integer
    + s.badges_current * (c->>'badge_current')::integer
    + s.badges_earned_lifetime * (c->>'badge_earned')::integer
    + s.badge_defenses * (c->>'badge_defense')::integer
    + least(s.best_win_streak, (c->>'streak_cap')::bigint) * (c->>'streak')::integer
    + (c->>'rate_scale')::integer * greatest(0,
        (s.pvp_wins + s.tournament_battle_wins + s.badge_wins + (c->>'rate_prior')::numeric / 2)
        / (s.pvp_battles + s.tournament_battles + s.badge_battles + (c->>'rate_prior')::numeric) - 0.5)
      * (s.pvp_battles + s.tournament_battles + s.badge_battles)::numeric
      / (s.pvp_battles + s.tournament_battles + s.badge_battles + (c->>'rate_sample')::numeric)
  )::bigint from (select config c from public.competitive_ranking_rules) rules;
$$;

create function public.refresh_trainer_badge_stats(p_player_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_player_id is null then return; end if;
  insert into public.competitive_trainer_stats(player_id) select player_id from public.competitive_players where player_id=p_player_id on conflict do nothing;
  insert into public.competitive_badge_achievements(player_id,badge_code)
    select p_player_id,b.code from public.badges b
    where b.code in (select jsonb_array_elements_text(config->'badge_codes') from public.competitive_ranking_rules)
      and (b.owner_player_id=p_player_id or exists (select 1 from public.badge_history h where h.badge_id=b.id
        and h.new_owner_player_id=p_player_id and h.event_type in ('INITIAL_CLAIM','TRANSFER')))
    on conflict do nothing;
  update public.competitive_trainer_stats s set
    badges_current = (select count(*) from public.badges b where b.owner_player_id=p_player_id
      and b.code in (select jsonb_array_elements_text(config->'badge_codes') from public.competitive_ranking_rules)),
    badges_earned_lifetime = (select count(*) from public.competitive_badge_achievements a where a.player_id=p_player_id),
    badge_defenses = (select count(*) from public.badge_history h where h.new_owner_player_id=p_player_id and h.event_type='DEFENSE'),
    title = case when public.has_pokemon_master_title(p_player_id) then 'MESTRE POKÉMON' end,
    updated_at = now()
  where s.player_id=p_player_id;
  update public.competitive_trainer_stats s set trainer_power=public.calculate_trainer_power(s) where s.player_id=p_player_id;
end $$;

create function public.ranking_badge_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare affected text;
begin
  if tg_table_name='badges' then
    for affected in select distinct id from unnest(array[case when tg_op <> 'INSERT' then old.owner_player_id end, case when tg_op <> 'DELETE' then new.owner_player_id end]) id where id is not null order by id loop
      perform public.refresh_trainer_badge_stats(affected);
    end loop;
  else
    perform public.refresh_trainer_badge_stats(new.new_owner_player_id);
  end if;
  return null;
end $$;
create trigger ranking_badge_ownership after insert or delete or update of owner_player_id on public.badges for each row execute function public.ranking_badge_changed();
create trigger ranking_badge_history after insert on public.badge_history for each row execute function public.ranking_badge_changed();

create function public.sync_trainer_ranking_profile(p_player_id text, p_display_name text, p_avatar_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_player_id is null or p_player_id !~ '^[A-Za-z0-9][A-Za-z0-9_:-]{2,127}$'
    or p_display_name is null or char_length(trim(p_display_name)) not between 1 and 18
    or p_avatar_id is null or p_avatar_id !~ '^avatar-0[1-9]$' then raise exception 'Invalid trainer identity' using errcode='22023'; end if;
  insert into public.competitive_players(player_id,display_name,avatar_id) values(p_player_id,trim(p_display_name),p_avatar_id)
    on conflict(player_id) do update set display_name=excluded.display_name,avatar_id=excluded.avatar_id;
  perform public.refresh_trainer_badge_stats(p_player_id);
  return public.get_public_trainer(p_player_id);
end $$;

create function public.settle_competitive_result(p_match_id text, p_player_id text, p_mode text, p_result text, p_opponent_player_id text, p_completed_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inserted integer; r public.competitive_match_results; receipt jsonb; rules jsonb; w integer;
begin
  if p_match_id is null or p_match_id !~ '^[A-Za-z0-9][A-Za-z0-9_:-]{2,159}$'
    or p_player_id is null or p_player_id !~ '^[A-Za-z0-9][A-Za-z0-9_:-]{2,127}$'
    or p_mode is null or p_mode not in ('CPU','PVP','JOURNEY','TOURNAMENT','BADGE')
    or p_result is null or p_result not in ('WIN','LOSS') or p_completed_at is null
    or p_completed_at > now()+interval '5 minutes'
    or (p_opponent_player_id is not null and (p_opponent_player_id=p_player_id or p_opponent_player_id !~ '^[A-Za-z0-9][A-Za-z0-9_:-]{2,127}$'))
    or (p_mode='PVP' and p_opponent_player_id is null)
    or (p_mode in ('CPU','JOURNEY') and p_opponent_player_id is not null)
  then raise exception 'Invalid completed result' using errcode='22023'; end if;
  -- Share-lock canonical badge ownership BEFORE the stats row. A transfer cannot
  -- invalidate an awarded receipt halfway through this settlement transaction.
  if p_mode in ('CPU','PVP','JOURNEY') then
    perform 1 from public.badges order by sort_order for share;
  end if;
  insert into public.competitive_match_results(match_id,player_id,mode,result,opponent_player_id,completed_at)
    values(p_match_id,p_player_id,p_mode,p_result,p_opponent_player_id,p_completed_at) on conflict do nothing;
  get diagnostics inserted=row_count;
  select * into r from public.competitive_match_results where match_id=p_match_id and player_id=p_player_id;
  if r.mode <> p_mode or r.result <> p_result or r.opponent_player_id is distinct from p_opponent_player_id then
    raise exception 'Conflicting duplicate result' using errcode='22023';
  end if;
  if inserted=1 then
    perform public.refresh_trainer_badge_stats(p_player_id);
    w := case when p_result='WIN' then 1 else 0 end;
    update public.competitive_trainer_stats s set
      total_battles=total_battles+1, wins=wins+w, losses=losses+1-w,
      cpu_battles=cpu_battles+(p_mode='CPU')::integer, cpu_wins=cpu_wins+(p_mode='CPU')::integer*w, cpu_losses=cpu_losses+(p_mode='CPU')::integer*(1-w),
      pvp_battles=pvp_battles+(p_mode='PVP')::integer, pvp_wins=pvp_wins+(p_mode='PVP')::integer*w, pvp_losses=pvp_losses+(p_mode='PVP')::integer*(1-w),
      journey_battles=journey_battles+(p_mode='JOURNEY')::integer, journey_wins=journey_wins+(p_mode='JOURNEY')::integer*w, journey_losses=journey_losses+(p_mode='JOURNEY')::integer*(1-w),
      tournament_battles=tournament_battles+(p_mode='TOURNAMENT')::integer, tournament_battle_wins=tournament_battle_wins+(p_mode='TOURNAMENT')::integer*w, tournament_battle_losses=tournament_battle_losses+(p_mode='TOURNAMENT')::integer*(1-w),
      badge_battles=badge_battles+(p_mode='BADGE')::integer, badge_wins=badge_wins+(p_mode='BADGE')::integer*w, badge_losses=badge_losses+(p_mode='BADGE')::integer*(1-w),
      current_win_streak=case when w=1 then current_win_streak+1 else 0 end,
      best_win_streak=greatest(best_win_streak,case when w=1 then current_win_streak+1 else 0 end),
      last_battle_at=greatest(last_battle_at,p_completed_at), updated_at=now()
    where player_id=p_player_id;
    update public.competitive_trainer_stats s set trainer_power=public.calculate_trainer_power(s) where player_id=p_player_id;
    select config into rules from public.competitive_ranking_rules;
    if rules->'master_modes' ? p_mode and (not (rules->>'master_victory_only')::boolean or w=1)
      and public.has_pokemon_master_title(p_player_id) then
      insert into public.competitive_reward_receipts(match_id,player_id,reward_type,amount)
        values(p_match_id,p_player_id,'POKEMON_MASTER_BATTLE_BONUS',(rules->>'master_bonus')::integer) on conflict do nothing;
    end if;
    update public.competitive_players set last_battle_at=greatest(last_battle_at,p_completed_at) where player_id=p_player_id;
  end if;
  select jsonb_build_object('id',id,'match_id',match_id,'player_id',player_id,'reward_type',reward_type,'amount',amount)
    into receipt from public.competitive_reward_receipts where match_id=p_match_id and player_id=p_player_id;
  return jsonb_build_object('accepted',inserted=1,'duplicate',inserted=0,'receipt',receipt);
end $$;

create function public.submit_competitive_result(p_match_id text, p_player_id text, p_mode text, p_result text, p_opponent_player_id text, p_completed_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_mode is null or p_mode not in ('CPU','PVP','JOURNEY') then raise exception 'Use canonical tournament/badge settlement' using errcode='22023'; end if;
  perform public.release_expired_badge_state();
  return public.settle_competitive_result(p_match_id,p_player_id,p_mode,p_result,p_opponent_player_id,p_completed_at);
end $$;

create function public.ranking_canonical_battle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare participant record; challenge public.badge_challenges; winner text; match_key text; battle_mode text;
begin
  if tg_table_name='tournament_matches' then
    if new.status <> 'FINISHED' or new.winner_id is null or (tg_op='UPDATE' and old.status='FINISHED') then return null; end if;
    if new.winner_id not in (new.player1_id,new.player2_id) then raise exception 'Invalid tournament winner'; end if;
    winner:=new.winner_id; match_key:=new.id::text; battle_mode:='TOURNAMENT';
    for participant in select player_id,display_name,coalesce(avatar_id,'avatar-01') avatar_id from public.tournament_players
      where tournament_id=new.tournament_id and player_id in (new.player1_id,new.player2_id) and not is_cpu order by player_id loop
      insert into public.competitive_players(player_id,display_name,avatar_id) values(participant.player_id,participant.display_name,participant.avatar_id) on conflict do nothing;
      perform public.settle_competitive_result(match_key,participant.player_id,battle_mode,case when participant.player_id=winner then 'WIN' else 'LOSS' end,
        case when participant.player_id=new.player1_id then new.player2_id else new.player1_id end,coalesce(new.finished_at,now()));
    end loop;
  else
    select * into challenge from public.badge_challenges where id=new.challenge_id;
    winner:=new.winner_player_id; match_key:=new.battle_id; battle_mode:='BADGE';
    if winner not in (challenge.challenger_player_id,coalesce(challenge.defender_player_id,'CPU')) then raise exception 'Invalid badge winner'; end if;
    for participant in select player_id from public.competitive_players where player_id in (challenge.challenger_player_id,challenge.defender_player_id) order by player_id loop
      perform public.settle_competitive_result(match_key,participant.player_id,battle_mode,case when participant.player_id=winner then 'WIN' else 'LOSS' end,
        case when participant.player_id=challenge.challenger_player_id then challenge.defender_player_id else challenge.challenger_player_id end,coalesce(new.completed_at,now()));
    end loop;
  end if;
  return null;
end $$;
create trigger ranking_tournament_battle after insert or update of status on public.tournament_matches for each row execute function public.ranking_canonical_battle();
create trigger ranking_badge_battle after insert on public.badge_challenge_battles for each row execute function public.ranking_canonical_battle();

create function public.ranking_tournament_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare participant record; final_match public.tournament_matches; inserted integer; event_kind text;
begin
  if tg_table_name='tournament_players' then
    if new.is_cpu then return null; end if;
    insert into public.competitive_players(player_id,display_name,avatar_id) values(new.player_id,new.display_name,coalesce(new.avatar_id,'avatar-01')) on conflict do nothing;
    insert into public.competitive_trainer_stats(player_id) values(new.player_id) on conflict do nothing;
    insert into public.competitive_tournament_receipts values(new.tournament_id,new.player_id,'ENTRY') on conflict do nothing;
    get diagnostics inserted=row_count;
    update public.competitive_trainer_stats s set tournament_entries=tournament_entries+inserted,updated_at=now() where player_id=new.player_id;
    update public.competitive_trainer_stats s set trainer_power=public.calculate_trainer_power(s) where player_id=new.player_id;
  else
    if new.status <> 'FINISHED' or old.status='FINISHED' then return null; end if;
    select * into final_match from public.tournament_matches where tournament_id=new.id and round='FINAL' and status='FINISHED';
    if not found then return null; end if;
    for participant in select * from public.tournament_players where tournament_id=new.id and not is_cpu order by player_id loop
      insert into public.competitive_players(player_id,display_name,avatar_id) values(participant.player_id,participant.display_name,coalesce(participant.avatar_id,'avatar-01')) on conflict do nothing;
      insert into public.competitive_trainer_stats(player_id) values(participant.player_id) on conflict do nothing;
      foreach event_kind in array array['ENTRY','FINAL','WIN'] loop
        if event_kind='ENTRY' or (event_kind='FINAL' and participant.player_id in (final_match.player1_id,final_match.player2_id))
          or (event_kind='WIN' and participant.player_id=final_match.winner_id) then
          insert into public.competitive_tournament_receipts values(new.id,participant.player_id,event_kind) on conflict do nothing;
          get diagnostics inserted=row_count;
          update public.competitive_trainer_stats set
            tournament_entries=tournament_entries+inserted*(event_kind='ENTRY')::integer,
            tournament_finals=tournament_finals+inserted*(event_kind='FINAL')::integer,
            tournament_wins=tournament_wins+inserted*(event_kind='WIN')::integer,updated_at=now() where player_id=participant.player_id;
        end if;
      end loop;
      update public.competitive_trainer_stats s set trainer_power=public.calculate_trainer_power(s) where player_id=participant.player_id;
    end loop;
  end if;
  return null;
end $$;
create trigger ranking_tournament_entry after insert on public.tournament_players for each row execute function public.ranking_tournament_event();
create trigger ranking_tournament_completion after update of status on public.tournaments for each row execute function public.ranking_tournament_event();

create view public.public_trainer_ranking as select
  s.player_id,p.display_name,p.avatar_id,s.total_battles,s.wins,s.losses,
  s.cpu_battles,s.cpu_wins,s.cpu_losses,s.pvp_battles,s.pvp_wins,s.pvp_losses,
  s.journey_battles,s.journey_wins,s.journey_losses,s.tournament_entries,s.tournament_wins,s.tournament_finals,
  s.badges_current,s.badges_earned_lifetime,s.badge_defenses,s.current_win_streak,s.best_win_streak,
  s.trainer_power,s.title,s.last_battle_at,s.updated_at,
  case when s.total_battles=0 then 0 else round(100.0*s.wins/s.total_battles) end win_rate
from public.competitive_trainer_stats s join public.competitive_players p using(player_id);

create function public.get_public_trainer(p_player_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(me) || jsonb_build_object('position',1+(select count(*) from public.competitive_trainer_stats ahead where
    (ahead.trainer_power,ahead.pvp_wins,ahead.tournament_wins,ahead.badge_defenses,ahead.wins) > (me.trainer_power,me.pvp_wins,me.tournament_wins,me.badge_defenses,me.wins)
    or ((ahead.trainer_power,ahead.pvp_wins,ahead.tournament_wins,ahead.badge_defenses,ahead.wins) = (me.trainer_power,me.pvp_wins,me.tournament_wins,me.badge_defenses,me.wins) and ahead.player_id collate "C" < me.player_id collate "C")))
  from public.public_trainer_ranking me where player_id=p_player_id;
$$;
create function public.get_trainer_ranking(p_player_id text default null, p_offset integer default 3, p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare podium jsonb; page jsonb; total bigint;
begin
  if p_offset is null or p_offset < 3 or p_offset > 100000 or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid ranking page' using errcode='22023'; end if;
  perform public.release_expired_badge_state();
  select count(*) into total from public.competitive_trainer_stats;
  select coalesce(jsonb_agg((to_jsonb(t)-'ordinal') || jsonb_build_object('position',t.ordinal) order by t.ordinal), '[]') into podium from
    (select v.*,row_number() over (order by trainer_power desc,pvp_wins desc,tournament_wins desc,badge_defenses desc,wins desc,player_id collate "C") ordinal from
      (select * from public.public_trainer_ranking order by trainer_power desc,pvp_wins desc,tournament_wins desc,badge_defenses desc,wins desc,player_id collate "C" limit 3) v) t;
  select coalesce(jsonb_agg((to_jsonb(t)-'ordinal') || jsonb_build_object('position',p_offset+t.ordinal) order by t.ordinal), '[]') into page from
    (select v.*,row_number() over (order by trainer_power desc,pvp_wins desc,tournament_wins desc,badge_defenses desc,wins desc,player_id collate "C") ordinal from
      (select * from public.public_trainer_ranking order by trainer_power desc,pvp_wins desc,tournament_wins desc,badge_defenses desc,wins desc,player_id collate "C" limit p_limit offset p_offset) v) t;
  return jsonb_build_object('top3',podium,'rows',page,'current',public.get_public_trainer(p_player_id),
    'nextOffset',case when p_offset+p_limit < total then p_offset+p_limit end,'total',total);
end $$;

-- Existing players retain identity; only current ownership and historical badge
-- claims/defenses are backfilled. No historical battles, streaks or tournaments.
insert into public.competitive_trainer_stats(player_id) select player_id from public.competitive_players on conflict do nothing;
do $$ declare p record; begin
  for p in select player_id from public.competitive_players loop perform public.refresh_trainer_badge_stats(p.player_id); end loop;
end $$;

alter table public.competitive_ranking_rules enable row level security;
alter table public.competitive_trainer_stats enable row level security;
alter table public.competitive_match_results enable row level security;
alter table public.competitive_reward_receipts enable row level security;
alter table public.competitive_tournament_receipts enable row level security;
alter table public.competitive_badge_achievements enable row level security;
create policy "ranking aggregates public read" on public.competitive_trainer_stats for select using (true);
revoke all on public.competitive_ranking_rules,public.competitive_trainer_stats,public.competitive_match_results,public.competitive_reward_receipts,public.competitive_tournament_receipts,public.competitive_badge_achievements from anon,authenticated;
grant select on public.competitive_trainer_stats,public.public_trainer_ranking to anon,authenticated;
-- PostgreSQL grants EXECUTE to PUBLIC by default: explicitly remove it on EVERY new function.
revoke all on function public.has_pokemon_master_title(text),public.calculate_trainer_power(public.competitive_trainer_stats),public.refresh_trainer_badge_stats(text),public.ranking_badge_changed(),public.ranking_canonical_battle(),public.ranking_tournament_event(),public.settle_competitive_result(text,text,text,text,text,timestamptz),public.sync_trainer_ranking_profile(text,text,text),public.submit_competitive_result(text,text,text,text,text,timestamptz),public.get_public_trainer(text),public.get_trainer_ranking(text,integer,integer) from public,anon,authenticated;
grant execute on function public.sync_trainer_ranking_profile(text,text,text),public.submit_competitive_result(text,text,text,text,text,timestamptz),public.get_public_trainer(text),public.get_trainer_ranking(text,integer,integer) to anon,authenticated;
-- These existing functions already qualify their application tables/helpers.
alter function public.register_competitive_player(text,text) set search_path = '';
alter function public.record_competitive_battle_activity(text,text,text,text) set search_path = '';
alter function public.record_badge_battle_result(uuid,text,text) set search_path = '';
commit;
