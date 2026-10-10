create table if not exists public.reviewed_search_zones (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.pet_reports(id) on delete cascade,
  created_at timestamptz not null default now(),
  checked_at timestamptz not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 500,
  note text,
  constraint reviewed_search_zones_note_check
    check (note is null or char_length(note) <= 96),
  constraint reviewed_search_zones_radius_check
    check (radius_m between 50 and 5000),
  constraint reviewed_search_zones_lat_check
    check (lat between -90 and 90),
  constraint reviewed_search_zones_lng_check
    check (lng between -180 and 180)
);

create index if not exists reviewed_search_zones_report_checked_idx
on public.reviewed_search_zones(report_id, checked_at desc);
