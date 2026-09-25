-- Presentation-only tournament metadata. player_id remains the identity.
alter table public.tournament_players
  add column if not exists avatar_id text not null default 'avatar-01'
  check (avatar_id ~ '^avatar-0[1-9]$');

update public.tournament_players
set avatar_id = 'avatar-01'
where avatar_id is null or avatar_id !~ '^avatar-0[1-9]$';

create or replace function public.join_tournament(
  p_tournament_id uuid,
  p_player_id text,
  p_display_name text,
  p_avatar_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tournament public.tournaments%rowtype;
  existing_slot smallint;
  available_slot smallint;
  participant_count integer;
begin
  select * into current_tournament from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception using errcode = 'PT001', message = 'Campeonato não encontrado'; end if;
  if current_tournament.status <> 'LOBBY' then raise exception using errcode = 'PT003', message = 'Campeonato não está disponível para entrada'; end if;

  select slot into existing_slot from public.tournament_players where tournament_id = p_tournament_id and player_id = p_player_id;
  if found then return jsonb_build_object('alreadyJoined', true, 'slot', existing_slot); end if;

  select count(*) into participant_count from public.tournament_players where tournament_id = p_tournament_id;
  if participant_count >= 4 then raise exception using errcode = 'PT002', message = 'Campeonato cheio'; end if;

  select candidate into available_slot from generate_series(1, 4) candidate
  where not exists (select 1 from public.tournament_players where tournament_id = p_tournament_id and slot = candidate)
  order by candidate limit 1;
  if available_slot is null then raise exception using errcode = 'PT002', message = 'Campeonato cheio'; end if;

  insert into public.tournament_players(tournament_id, player_id, display_name, avatar_id, slot)
  values (p_tournament_id, p_player_id, left(trim(p_display_name), 18), case when p_avatar_id ~ '^avatar-0[1-9]$' then p_avatar_id else 'avatar-01' end, available_slot);
  return jsonb_build_object('alreadyJoined', false, 'slot', available_slot, 'participantCount', participant_count + 1);
end;
$$;

grant execute on function public.join_tournament(uuid, text, text, text) to anon, authenticated;
