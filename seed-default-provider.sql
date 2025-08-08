-- Seed one default provider and map to all active services
-- Safe to re-run

-- 1) Insert provider if not exists
insert into public.providers (id, name, email, phone, is_active)
values ('00000000-0000-0000-0000-000000000001', 'Default Provider', 'default@provider.local', '000-000-0000', true)
on conflict (id) do update set is_active = excluded.is_active;

-- 2) Map provider to all services (idempotent)
insert into public.provider_services (provider_id, service_id, is_active)
select '00000000-0000-0000-0000-000000000001', s.id, true
from public.services s
on conflict (provider_id, service_id) do update set is_active = excluded.is_active;

