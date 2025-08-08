-- Service catalog and provider mapping (using users table)

create extension if not exists pgcrypto;

-- Helper trigger function
create or replace function public.update_updated_at_column()
returns trigger as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$ language plpgsql;

-- Canonical service catalog: providers will pick from this; includes price/description
create table if not exists public.service_catalog (
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

drop trigger if exists trg_service_catalog_updated_at on public.service_catalog;
create trigger trg_service_catalog_updated_at
  before update on public.service_catalog
  for each row execute function public.update_updated_at_column();

-- Mapping: which catalog items a provider (user with user_type='provider') offers
create table if not exists public.provider_services (
  provider_id uuid not null references auth.users(id) on delete cascade,
  catalog_id uuid not null references public.service_catalog(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_id, catalog_id)
);

drop trigger if exists trg_provider_services_updated_at on public.provider_services;
create trigger trg_provider_services_updated_at
  before update on public.provider_services
  for each row execute function public.update_updated_at_column();

create index if not exists idx_provider_services_provider on public.provider_services(provider_id);
create index if not exists idx_provider_services_catalog on public.provider_services(catalog_id);

-- Seed catalog (idempotent)
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

