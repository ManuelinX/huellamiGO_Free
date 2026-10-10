create table if not exists public.geocoding_provider_usage (
  provider text not null,
  period_month date not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (provider, period_month),
  constraint geocoding_provider_usage_provider_check
    check (provider in ('mapbox')),
  constraint geocoding_provider_usage_request_count_check
    check (request_count >= 0)
);

drop trigger if exists set_geocoding_provider_usage_updated_at on public.geocoding_provider_usage;
create trigger set_geocoding_provider_usage_updated_at
before update on public.geocoding_provider_usage
for each row
execute function public.set_updated_at();
