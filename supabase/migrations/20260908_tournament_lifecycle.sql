-- Lifecycle transitions are database-owned so stale clients cannot mutate a locked bracket.
create or replace function public.leave_tournament(
  p_tournament_id uuid,
  p_player_id text
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
  if current_tournament.status <> 'LOBBY' then raise exception using errcode = 'PT004', message = 'O campeonato ja iniciou. Voltar ao hub nao remove sua participacao'; end if;
  if current_tournament.created_by_player_id = p_player_id then raise exception using errcode = 'PT005', message = 'Quem criou deve cancelar o campeonato, nao sair dele'; end if;

  delete from public.tournament_players where tournament_id = p_tournament_id and player_id = p_player_id;
  if not found then raise exception using errcode = 'PT006', message = 'Voce nao participa deste campeonato'; end if;
end;
$$;

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
  if current_tournament.status <> 'LOBBY' then raise exception using errcode = 'PT008', message = 'O campeonato ja iniciou e nao pode ser cancelado'; end if;

  update public.tournaments set status = 'CANCELLED', finished_at = now() where id = p_tournament_id;
end;
$$;

create or replace function public.start_tournament(
  p_tournament_id uuid,
  p_organizer_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tournament public.tournaments%rowtype;
  player_ids text[];
begin
  select * into current_tournament from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception using errcode = 'PT001', message = 'Campeonato nao encontrado'; end if;
  if current_tournament.created_by_player_id <> p_organizer_id then raise exception using errcode = 'PT007', message = 'Apenas quem criou pode iniciar o campeonato'; end if;
  if current_tournament.status = 'SEMIFINALS' and exists (select 1 from public.tournament_matches where tournament_id = p_tournament_id and round = 'SEMIFINAL') then return; end if;
  if current_tournament.status <> 'LOBBY' then raise exception using errcode = 'PT009', message = 'Este campeonato nao esta mais no lobby'; end if;

  select array_agg(player_id order by random()) into player_ids from public.tournament_players where tournament_id = p_tournament_id;
  if coalesce(array_length(player_ids, 1), 0) <> 4 then raise exception using errcode = 'PT010', message = 'Sao necessarios 4 jogadores para iniciar'; end if;

  update public.tournaments set status = 'SEMIFINALS', started_at = now() where id = p_tournament_id;
  insert into public.tournament_matches(tournament_id, round, round_index, player1_id, player2_id, status, battle_room_code)
  values
    (p_tournament_id, 'SEMIFINAL', 1, player_ids[1], player_ids[2], 'WAITING', 'PKT-' || left(p_tournament_id::text, 8) || '-1'),
    (p_tournament_id, 'SEMIFINAL', 2, player_ids[3], player_ids[4], 'WAITING', 'PKT-' || left(p_tournament_id::text, 8) || '-2');
end;
$$;

grant execute on function public.leave_tournament(uuid, text) to anon, authenticated;
grant execute on function public.cancel_tournament(uuid, text) to anon, authenticated;
grant execute on function public.start_tournament(uuid, text) to anon, authenticated;
