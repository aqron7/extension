-- KalshiEdge — Supabase schema
-- Run this in the Supabase SQL editor (or via the CLI) on a fresh project.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- User profiles (linked to Supabase auth)
create table if not exists profiles (
  id uuid references auth.users primary key,
  email text,
  stripe_customer_id text,
  plan text default 'free', -- 'free' | 'pro'
  plan_expires_at timestamptz,
  created_at timestamptz default now()
);

-- Watchlist markets per user
create table if not exists watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  ticker text not null,
  title text,
  added_at timestamptz default now(),
  unique(user_id, ticker)
);

-- Price alerts per user (pro only)
create table if not exists alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  ticker text not null,
  title text,
  condition text not null, -- 'above' | 'below'
  threshold numeric not null, -- 0-99 cents
  triggered boolean default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table watchlist enable row level security;
alter table alerts enable row level security;

-- profiles: a user can read and update only their own row.
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- watchlist: full CRUD scoped to the owning user.
drop policy if exists "watchlist_all_own" on watchlist;
create policy "watchlist_all_own" on watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- alerts: full CRUD scoped to the owning user.
drop policy if exists "alerts_all_own" on alerts;
create policy "alerts_all_own" on alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
