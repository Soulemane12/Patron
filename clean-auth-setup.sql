-- Clean authentication and user management setup
-- Run this to start fresh

-- Drop all existing tables (be careful!)
do $$
declare
    r record;
begin
    for r in (select tablename from pg_tables where schemaname = 'public') loop
        execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade';
    end loop;
end $$;

-- Drop all functions
do $$
declare
    r record;
begin
    for r in (select proname from pg_proc where pronamespace = (select oid from pg_namespace where nspname = 'public')) loop
        execute 'drop function if exists public.' || quote_ident(r.proname) || ' cascade';
    end loop;
end $$;

-- Drop all enums
do $$
declare
    r record;
begin
    for r in (select typname from pg_type where typnamespace = (select oid from pg_namespace where nspname = 'public') and typtype = 'e') loop
        execute 'drop type if exists public.' || quote_ident(r.typname) || ' cascade';
    end loop;
end $$;

-- Enable extensions
create extension if not exists pgcrypto;

-- Create user types enum
create type public.user_type as enum ('customer', 'provider', 'admin');

-- Helper function for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$ language plpgsql;

-- User profiles table (extends auth.users)
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  user_type public.user_type not null default 'customer',
  phone text,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add RLS policies for user_profiles
alter table public.user_profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
on public.user_profiles for select
using (auth.uid() = id);

-- Users can insert their own profile
create policy "Users can insert own profile"
on public.user_profiles for insert
with check (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
on public.user_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Admins can read all profiles
create policy "Admins can read all profiles"
on public.user_profiles for select
using (
  exists (
    select 1 from public.user_profiles 
    where id = auth.uid() and user_type = 'admin'
  )
);

-- Add trigger for updated_at
create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.update_updated_at_column();

-- Service catalog
create table public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  description text,
  price numeric(10,2) not null,
  currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_service_catalog_updated_at
  before update on public.service_catalog
  for each row execute function public.update_updated_at_column();

-- Provider services mapping
create table public.provider_services (
  provider_id uuid not null references auth.users(id) on delete cascade,
  catalog_id uuid not null references public.service_catalog(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_id, catalog_id)
);

create trigger trg_provider_services_updated_at
  before update on public.provider_services
  for each row execute function public.update_updated_at_column();

create index idx_provider_services_provider on public.provider_services(provider_id);
create index idx_provider_services_catalog on public.provider_services(catalog_id);

-- Service requests
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider_id uuid references auth.users(id) on delete set null,
  service_id uuid references public.service_catalog(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'cancelled')),
  scheduled_date timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null
);

create trigger trg_service_requests_updated_at
  before update on public.service_requests
  for each row execute function public.update_updated_at_column();

create index idx_service_requests_user_id on public.service_requests(user_id);
create index idx_service_requests_provider_id on public.service_requests(provider_id);
create index idx_service_requests_status on public.service_requests(status);

-- Seed some catalog items
insert into public.service_catalog (code, name, description, price)
values
  ('BASIC_INSTALL', 'Basic Install', 'Standard installation package', 0),
  ('PREMIUM_INSTALL', 'Premium Install', 'Advanced install with extras', 0),
  ('MAINTENANCE', 'Maintenance Visit', 'Routine maintenance service', 0)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  updated_at = now();

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, name, user_type)
  values (new.id, new.email, new.raw_user_meta_data->>'name', 'customer');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Refresh schema cache
notify pgrst, 'reload schema'; 