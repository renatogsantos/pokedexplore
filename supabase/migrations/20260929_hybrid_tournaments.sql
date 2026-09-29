-- Persistent hybrid-tournament state. Existing brackets remain NORMAL at 100%.
alter table public.tournaments
  add column if not exists mode text not null default 'NORMAL' check (mode in ('NORMAL','HYBRID')),
  add column if not exists reward_multiplier numeric not null default 1 check (reward_multiplier in (0.5, 1)),
  add column if not exists registration_locked boolean not null default false;
alter table public.tournament_players
  add column if not exists is_cpu boolean not null default false,
  add column if not exists cpu_team jsonb;

create or replace function public.fill_tournament_with_cpu(p_tournament_id uuid, p_organizer_id text)
returns void language plpgsql security definer set search_path = public as $$
declare tournament_row public.tournaments%rowtype; humans integer; total integer;
begin
  select * into tournament_row from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception using errcode = 'PT001', message = 'Campeonato nao encontrado'; end if;
  if tournament_row.created_by_player_id <> p_organizer_id then raise exception using errcode = 'PT007', message = 'Apenas quem criou pode completar com CPU'; end if;
  if tournament_row.status <> 'LOBBY' or tournament_row.registration_locked or tournament_row.mode <> 'NORMAL' then raise exception using errcode = 'PT020', message = 'Campeonato nao esta disponivel para completar'; end if;
  select count(*), count(*) filter (where not is_cpu) into total, humans from public.tournament_players where tournament_id = p_tournament_id;
  if total <> 2 or humans <> 2 then raise exception using errcode = 'PT021', message = 'Sao necessarios exatamente 2 jogadores humanos'; end if;
  update public.tournaments set mode = 'HYBRID', reward_multiplier = 0.5, registration_locked = true where id = p_tournament_id;
  insert into public.tournament_players(tournament_id, player_id, display_name, avatar_id, slot, is_cpu, cpu_team)
  values
    (p_tournament_id, 'cpu:' || p_tournament_id::text || ':atlas', 'CPU Atlas', 'trainer-4', 3, true, '[]'::jsonb),
    (p_tournament_id, 'cpu:' || p_tournament_id::text || ':nova', 'CPU Nova', 'trainer-7', 4, true, '[]'::jsonb);
end; $$;
grant execute on function public.fill_tournament_with_cpu(uuid, text) to anon, authenticated;

-- Lock late human joins after hybrid activation.
create or replace function public.join_tournament(p_tournament_id uuid, p_player_id text, p_display_name text, p_avatar_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tournament_row public.tournaments%rowtype; slot_value smallint; existing smallint; count_value integer;
begin
 select * into tournament_row from public.tournaments where id=p_tournament_id for update;
 if not found then raise exception using errcode='PT001', message='Campeonato nao encontrado'; end if;
 if tournament_row.status <> 'LOBBY' or tournament_row.registration_locked then raise exception using errcode='PT003', message='Campeonato nao esta disponivel para entrada'; end if;
 select slot into existing from public.tournament_players where tournament_id=p_tournament_id and player_id=p_player_id;
 if found then return jsonb_build_object('alreadyJoined',true,'slot',existing); end if;
 select count(*) into count_value from public.tournament_players where tournament_id=p_tournament_id;
 if count_value >= 4 then raise exception using errcode='PT002', message='Campeonato cheio'; end if;
 select candidate into slot_value from generate_series(1,4) candidate where not exists(select 1 from public.tournament_players where tournament_id=p_tournament_id and slot=candidate) order by candidate limit 1;
 insert into public.tournament_players(tournament_id,player_id,display_name,avatar_id,slot) values(p_tournament_id,p_player_id,left(trim(p_display_name),18),p_avatar_id,slot_value);
 return jsonb_build_object('alreadyJoined',false,'slot',slot_value,'participantCount',count_value+1);
end; $$;
