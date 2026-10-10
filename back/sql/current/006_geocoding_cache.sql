create table if not exists public.geocoding_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mapbox',
  lat double precision not null,
  lng double precision not null,
  point gis.geography(Point, 4326) not null,
  formatted_address text not null,
  country text,
  state text,
  city text,
  municipality text,
  neighborhood text,
  postcode text,
  street text,
  place_name text,
  confidence text,
  quality text,
  raw_response jsonb,
  hit_count integer not null default 0,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geocoding_cache_provider_check
    check (provider in ('mapbox')),
  constraint geocoding_cache_lat_check
    check (lat between -90 and 90),
  constraint geocoding_cache_lng_check
    check (lng between -180 and 180),
  constraint geocoding_cache_hit_count_check
    check (hit_count >= 0)
);

create index if not exists geocoding_cache_point_gist_idx
on public.geocoding_cache
using gist (point);

create index if not exists geocoding_cache_cleanup_idx
on public.geocoding_cache(hit_count, last_used_at, created_at);

create index if not exists geocoding_cache_expires_at_idx
on public.geocoding_cache(expires_at);

drop trigger if exists set_geocoding_cache_updated_at on public.geocoding_cache;
create trigger set_geocoding_cache_updated_at
before update on public.geocoding_cache
for each row
execute function public.set_updated_at();
