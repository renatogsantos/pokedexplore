-- Settle a semifinal and advance the bracket in one database transaction.
-- Locking the tournament serializes simultaneous semifinal completions.
create or replace function public.complete_tournament_semifinal(
  p_match_id uuid,
  p_winner_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_match public.tournament_matches%rowtype;
  current_tournament public.tournaments%rowtype;
  loser_id text;
  finalists text[];
begin
  select * into current_match from public.tournament_matches where id = p_match_id;
  if not found then raise exception using errcode = 'PT011', message = 'Partida nao encontrada'; end if;

  select * into current_tournament from public.tournaments where id = current_match.tournament_id for update;
  if not found then raise exception using errcode = 'PT001', message = 'Campeonato nao encontrado'; end if;
  select * into current_match from public.tournament_matches where id = p_match_id for update;
  if current_match.round <> 'SEMIFINAL' then raise exception using errcode = 'PT012', message = 'A partida nao e uma semifinal'; end if;
  if p_winner_id not in (current_match.player1_id, current_match.player2_id) then raise exception using errcode = 'PT014', message = 'Vencedor invalido para esta partida'; end if;
  if current_match.status = 'FINISHED' and current_match.winner_id <> p_winner_id then
    raise exception using errcode = 'PT015', message = 'Esta semifinal ja possui outro vencedor';
  end if;
  if current_tournament.status not in ('SEMIFINALS', 'FINAL') then
    if current_match.status = 'FINISHED' and current_tournament.status = 'FINISHED' then return; end if;
    raise exception using errcode = 'PT013', message = 'O campeonato nao aceita este resultado';
  end if;

  loser_id := case when current_match.player1_id = p_winner_id then current_match.player2_id else current_match.player1_id end;
  update public.tournament_matches
    set winner_id = p_winner_id, status = 'FINISHED', finished_at = coalesce(finished_at, now())
    where id = p_match_id and status <> 'FINISHED';
  update public.tournament_players set status = 'QUALIFIED'
    where tournament_id = current_match.tournament_id and player_id = p_winner_id and status <> 'CHAMPION';
  update public.tournament_players set status = 'ELIMINATED'
    where tournament_id = current_match.tournament_id and player_id = loser_id;

  select array_agg(winner_id order by round_index) into finalists
    from public.tournament_matches
    where tournament_id = current_match.tournament_id and round = 'SEMIFINAL' and status = 'FINISHED';
  if coalesce(array_length(finalists, 1), 0) = 2 then
    insert into public.tournament_matches
      (tournament_id, round, round_index, player1_id, player2_id, status, battle_room_code)
    values
      (current_match.tournament_id, 'FINAL', 1, finalists[1], finalists[2], 'WAITING',
       'PKT-' || left(current_match.tournament_id::text, 8) || '-F')
    on conflict (tournament_id, round, round_index) do nothing;
    update public.tournaments set status = 'FINAL'
      where id = current_match.tournament_id and status = 'SEMIFINALS';
  end if;
end;
$$;

grant execute on function public.complete_tournament_semifinal(uuid, text) to anon, authenticated;
