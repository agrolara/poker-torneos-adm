-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Profiles Table (extends auth.users) if not exists
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  is_super_admin boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- Drop existing policies if they exist to prevent "already exists" errors
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Create trigger to automatically create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, is_super_admin)
  values (
    new.id, 
    new.raw_user_meta_data->>'name',
    (new.email = 'materiales.integrity@gmail.com')
  )
  on conflict (id) do update
  set is_super_admin = (new.email = 'materiales.integrity@gmail.com');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to prevent duplicate triggers
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create Players Table if not exists
create table if not exists public.players (
  id uuid default gen_random_uuid() primary key,
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.players enable row level security;

drop policy if exists "Organizers can manage their players" on public.players;

create policy "Organizers can manage their players" on public.players
  for all using (auth.uid() = organizer_id);

-- Create Blind Structures Table if not exists
create table if not exists public.blind_structures (
  id uuid default gen_random_uuid() primary key,
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  levels jsonb not null, -- Array of levels
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.blind_structures enable row level security;

drop policy if exists "Organizers can manage their blind structures" on public.blind_structures;

create policy "Organizers can manage their blind structures" on public.blind_structures
  for all using (auth.uid() = organizer_id);

-- Create Tournaments Table if not exists
create table if not exists public.tournaments (
  id uuid default gen_random_uuid() primary key,
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed')),
  buy_in_amount numeric default 0,
  buy_in_chips numeric default 0,
  rebuy_amount numeric default 0,
  rebuy_chips numeric default 0,
  add_on_amount numeric default 0,
  add_on_chips numeric default 0,
  current_level_index integer default 0,
  seconds_remaining integer default 0,
  is_timer_running boolean default false,
  max_players_per_table integer default 10,
  payout_structure jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.tournaments enable row level security;

drop policy if exists "Organizers can manage their tournaments" on public.tournaments;

create policy "Organizers can manage their tournaments" on public.tournaments
  for all using (auth.uid() = organizer_id);

-- Create Tournament Players Table if not exists
create table if not exists public.tournament_players (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete set null,
  guest_name text,
  status text not null default 'active' check (status in ('active', 'eliminated')),
  rebuys_count integer default 0 not null,
  has_add_on boolean default false not null,
  table_number integer,
  seat_number integer,
  elimination_position integer,
  payout_amount numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.tournament_players enable row level security;

drop policy if exists "Organizers can manage players in their tournaments" on public.tournament_players;

create policy "Organizers can manage players in their tournaments" on public.tournament_players
  for all using (
    exists (
      select 1 from public.tournaments 
      where tournaments.id = tournament_players.tournament_id 
      and tournaments.organizer_id = auth.uid()
    )
  );

-- Create Tournament Logs Table if not exists
create table if not exists public.tournament_logs (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.tournament_logs enable row level security;

drop policy if exists "Organizers can manage logs of their tournaments" on public.tournament_logs;

create policy "Organizers can manage logs of their tournaments" on public.tournament_logs
  for all using (
    exists (
      select 1 from public.tournaments 
      where tournaments.id = tournament_logs.tournament_id 
      and tournaments.organizer_id = auth.uid()
    )
  );

-- Create League Codes Table if not exists
create table if not exists public.league_codes (
  code text primary key,
  created_by uuid references public.profiles(id) on delete cascade not null,
  used_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.league_codes enable row level security;

drop policy if exists "Super admins can manage all codes" on public.league_codes;
drop policy if exists "Anyone can check code validity" on public.league_codes;
drop policy if exists "Registering users can claim code" on public.league_codes;

create policy "Super admins can manage all codes" on public.league_codes
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_super_admin = true
    )
  );

create policy "Anyone can check code validity" on public.league_codes
  for select using (true);

create policy "Registering users can claim code" on public.league_codes
  for update using (true) with check (used_by = auth.uid());
