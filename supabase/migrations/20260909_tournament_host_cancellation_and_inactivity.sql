-- A tournament can be stopped by its organizer while it is active.  A database
-- job also closes brackets that have been idle for five minutes, so this does
-- not depend on an open browser tab.
alter table public.tournaments
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists cancellation_reason text check (cancellation_reason in ('HOST', 'INACTIVITY'));

create index if not exists tournaments_active_activity_idx
  on public.tournaments (status, last_activity_at)
  where status in ('LOBBY', 'SEMIFINALS', 'FINAL');

create or replace function public.touch_tournament_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tournaments
    set last_activity_at = now()
    where id = coalesce(new.tournament_id, old.tournament_id)
      and status in ('LOBBY', 'SEMIFINALS', 'FINAL');
  return coalesce(new, old);
end;
$$;

drop trigger if exists tournament_players_touch_activity on public.tournament_players;
create trigger tournament_players_touch_activity
after insert or update or delete on public.tournament_players
for each row execute function public.touch_tournament_activity();

drop trigger if exists tournament_matches_touch_activity on public.tournament_matches;
create trigger tournament_matches_touch_activity
after insert or update or delete on public.tournament_matches
for each row execute function public.touch_tournament_activity();

create or replace function public.cancel_tournament(
  p_tournament_id uuid,
  p_organizer_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tournament public.tournaments%rowtype;
begin
  select * into current_tournament from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception using errcode = 'PT001', message = 'Campeonato nao encontrado'; end if;
  if current_tournament.created_by_player_id <> p_organizer_id then raise exception using errcode = 'PT007', message = 'Apenas quem criou pode cancelar o campeonato'; end if;
  if current_tournament.status = 'CANCELLED' then return; end if;
  if current_tournament.status not in ('LOBBY', 'SEMIFINALS', 'FINAL') then raise exception using errcode = 'PT008', message = 'Este campeonato ja foi finalizado'; end if;

  update public.tournaments
    set status = 'CANCELLED', finished_at = now(), last_activity_at = now(), cancellation_reason = 'HOST'
    where id = p_tournament_id;
end;
$$;

create or replace function public.mark_tournament_match_playing(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_match public.tournament_matches%rowtype;
  current_tournament public.tournaments%rowtype;
begin
  select * into current_match from public.tournament_matches where id = p_match_id for update;
  if not found then raise exception using errcode = 'PT011', message = 'Partida do campeonato nao encontrada'; end if;
  select * into current_tournament from public.tournaments where id = current_match.tournament_id for update;
  if current_tournament.status not in ('SEMIFINALS', 'FINAL') then raise exception using errcode = 'PT012', message = 'Este campeonato nao esta em andamento'; end if;

  update public.tournament_matches
    set status = 'PLAYING', started_at = coalesce(started_at, now())
    where id = p_match_id and status in ('WAITING', 'READY');
end;
$$;

create or replace function public.cancel_inactive_tournaments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cancelled_count integer;
begin
  with cancelled as (
    update public.tournaments tournament
      set status = 'CANCELLED',
          finished_at = now(),
          last_activity_at = now(),
          cancellation_reason = 'INACTIVITY'
      where tournament.status in ('LOBBY', 'SEMIFINALS', 'FINAL')
        and tournament.last_activity_at <= now() - interval '5 minutes'
        and not exists (
          select 1 from public.tournament_matches match
          where match.tournament_id = tournament.id and match.status = 'PLAYING'
        )
      returning tournament.id
  ) select count(*) into cancelled_count from cancelled;
  return cancelled_count;
end;
$$;

create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'cancel-inactive-tournaments') then
    perform cron.schedule(
      'cancel-inactive-tournaments',
      '* * * * *',
      'select public.cancel_inactive_tournaments()'
    );
  end if;
end;
$$;

grant execute on function public.mark_tournament_match_playing(uuid) to anon, authenticated;
revoke all on function public.cancel_inactive_tournaments() from public;
