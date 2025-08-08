-- Enable required extensions
create extension if not exists pgcrypto;

-- Enum for request status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum (
      'pending',
      'assigned',
      'in_progress',
      'completed',
      'cancelled',
      'expired'
    );
  end if;
end$$;

-- Helper trigger function to auto-update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Global settings table for fixed pricing (all services same price)
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.update_updated_at_column();

-- Ensure a default global service price exists (update the value as needed)
insert into public.settings (key, value)
values ('default_service_price', jsonb_build_object('currency', 'USD', 'amount', 0))
on conflict (key) do nothing;

-- Services table (providers do NOT set prices; a global price is used)
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_services_updated_at
  before update on public.services
  for each row execute function public.update_updated_at_column();

-- Providers table
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_providers_updated_at
  before update on public.providers
  for each row execute function public.update_updated_at_column();

-- Mapping of which services a provider can perform
create table if not exists public.provider_services (
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_id, service_id)
);

create trigger trg_provider_services_updated_at
  before update on public.provider_services
  for each row execute function public.update_updated_at_column();

create index if not exists idx_provider_services_provider_id on public.provider_services using btree (provider_id);
create index if not exists idx_provider_services_service_id on public.provider_services using btree (service_id);
create index if not exists idx_provider_services_is_active on public.provider_services using btree (is_active);

-- Service requests table per provided spec (with FK to services)
create table if not exists public.service_requests (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  provider_id uuid null references public.providers(id) on delete set null,
  service_id uuid null references public.services(id) on delete cascade,
  status public.request_status not null default 'pending'::request_status,
  request_date timestamp with time zone null default now(),
  scheduled_date timestamp with time zone null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  claimed_at timestamp with time zone null,
  claimed_by uuid null references public.providers(id) on delete set null,
  expires_at timestamp with time zone null,
  constraint service_requests_pkey primary key (id)
);

create index if not exists idx_service_requests_user_id on public.service_requests using btree (user_id);
create index if not exists idx_service_requests_provider_id on public.service_requests using btree (provider_id);
create index if not exists idx_service_requests_status on public.service_requests using btree (status);
create index if not exists idx_service_requests_claimed_by on public.service_requests using btree (claimed_by);
create index if not exists idx_service_requests_scheduled_date on public.service_requests using btree (scheduled_date);

create trigger update_service_requests_updated_at
  before update on public.service_requests
  for each row execute function public.update_updated_at_column();

