-- Create the missing provider_profiles table that Supabase Auth UI expects

create table if not exists public.provider_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  user_type text default 'provider',
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add RLS policies for provider_profiles
alter table public.provider_profiles enable row level security;

-- Allow users to read their own profile
create policy "Users can read own provider profile"
on public.provider_profiles for select
using (auth.uid() = id);

-- Allow users to insert their own profile
create policy "Users can insert own provider profile"
on public.provider_profiles for insert
with check (auth.uid() = id);

-- Allow users to update their own profile
create policy "Users can update own provider profile"
on public.provider_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Add trigger for updated_at
drop trigger if exists trg_provider_profiles_updated_at on public.provider_profiles;
create trigger trg_provider_profiles_updated_at
  before update on public.provider_profiles
  for each row execute function public.update_updated_at_column();

-- Refresh schema cache
notify pgrst, 'reload schema'; 