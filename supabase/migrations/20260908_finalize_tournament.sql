-- A final is the terminal transaction: no client can leave a partially-finished tournament.
create or replace function public.finish_tournament_final(
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
begin
  select * into current_match from public.tournament_matches where id = p_match_id;
  if not found then raise exception using errcode = 'PT011', message = 'Partida nao encontrada'; end if;

  select * into current_tournament from public.tournaments where id = current_match.tournament_id for update;
  if not found then raise exception using errcode = 'PT001', message = 'Campeonato nao encontrado'; end if;
  select * into current_match from public.tournament_matches where id = p_match_id;
  if current_match.round <> 'FINAL' then raise exception using errcode = 'PT012', message = 'Apenas a final encerra o campeonato'; end if;
  if current_match.status = 'FINISHED' and current_tournament.status = 'FINISHED' then return; end if;
  if current_tournament.status <> 'FINAL' then raise exception using errcode = 'PT013', message = 'O campeonato nao esta pronto para ser encerrado'; end if;
  if p_winner_id not in (current_match.player1_id, current_match.player2_id) then raise exception using errcode = 'PT014', message = 'Vencedor invalido para esta final'; end if;

  loser_id := case when current_match.player1_id = p_winner_id then current_match.player2_id else current_match.player1_id end;
  update public.tournament_matches set winner_id = p_winner_id, status = 'FINISHED', finished_at = now() where id = p_match_id and status <> 'FINISHED';
  update public.tournament_players set status = 'CHAMPION' where tournament_id = current_tournament.id and player_id = p_winner_id;
  update public.tournament_players set status = 'ELIMINATED' where tournament_id = current_tournament.id and player_id = loser_id;
  update public.tournaments set status = 'FINISHED', finished_at = now() where id = current_tournament.id;
end;
$$;

grant execute on function public.finish_tournament_final(uuid, text) to anon, authenticated;
