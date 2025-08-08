-- Enforce service_requests inserts have provider_id null and status 'pending'
-- Safe to re-run

create or replace function public.enforce_pending_request_defaults()
returns trigger as $fn$
begin
  new.provider_id := null;
  new.claimed_by := null;
  new.claimed_at := null;
  new.expires_at := null;
  new.status := 'pending';
  return new;
end;
$fn$ language plpgsql;

do $$
begin
  if to_regclass('public.service_requests') is not null then
    execute 'drop trigger if exists trg_service_requests_pending_defaults on public.service_requests';
    execute 'create trigger trg_service_requests_pending_defaults before insert on public.service_requests for each row execute function public.enforce_pending_request_defaults()';
  end if;
end $$;

