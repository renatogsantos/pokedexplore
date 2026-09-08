-- The lobby has four participants, independently from the two-player battle rooms.
-- Row locking makes participant count and slot assignment atomic for concurrent joins.
create or replace function public.join_tournament(
  p_tournament_id uuid,
  p_player_id text,
  p_display_name text
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

  insert into public.tournament_players(tournament_id, player_id, display_name, slot)
  values (p_tournament_id, p_player_id, left(trim(p_display_name), 18), available_slot);
  return jsonb_build_object('alreadyJoined', false, 'slot', available_slot, 'participantCount', participant_count + 1);
end;
$$;
grant execute on function public.join_tournament(uuid, text, text) to anon, authenticated;
