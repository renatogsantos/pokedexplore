create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(), code text not null unique check (code ~ '^PKC-[0-9]{4}$'), status text not null default 'LOBBY' check (status in ('LOBBY','SEMIFINALS','FINAL','FINISHED','CANCELLED')), created_by_player_id text not null, created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz
);
create table if not exists public.tournament_players (
  id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade, player_id text not null, display_name text not null check (char_length(display_name) between 1 and 18), slot smallint not null check (slot between 1 and 4), status text not null default 'WAITING' check (status in ('WAITING','QUALIFIED','ELIMINATED','CHAMPION')), joined_at timestamptz not null default now(), unique(tournament_id, player_id), unique(tournament_id, slot)
);
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade, round text not null check (round in ('SEMIFINAL','FINAL')), round_index smallint not null, player1_id text not null, player2_id text not null, winner_id text, status text not null default 'WAITING' check (status in ('WAITING','READY','PLAYING','FINISHED')), battle_room_code text not null, created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz, unique(tournament_id, round, round_index), check (player1_id <> player2_id), check (winner_id is null or winner_id in (player1_id, player2_id))
);
create index if not exists tournaments_status_idx on public.tournaments(status);
create index if not exists tournament_players_player_idx on public.tournament_players(player_id);
create index if not exists tournament_matches_tournament_idx on public.tournament_matches(tournament_id);
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_matches enable row level security;
create policy "casual tournament read" on public.tournaments for select using (true);
create policy "casual tournament insert" on public.tournaments for insert with check (true);
create policy "casual tournament update" on public.tournaments for update using (true) with check (true);
create policy "casual tournament read" on public.tournament_players for select using (true);
create policy "casual tournament insert" on public.tournament_players for insert with check (true);
create policy "casual tournament update" on public.tournament_players for update using (true) with check (true);
create policy "casual tournament read" on public.tournament_matches for select using (true);
create policy "casual tournament insert" on public.tournament_matches for insert with check (true);
create policy "casual tournament update" on public.tournament_matches for update using (true) with check (true);
alter publication supabase_realtime add table public.tournaments, public.tournament_players, public.tournament_matches;
