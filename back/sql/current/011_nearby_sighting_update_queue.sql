create table if not exists public.nearby_sighting_update_queue (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.pet_reports(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  status text not null default 'pending',
  reason text,
  decision jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nearby_sighting_update_queue_window_check
    check (window_end > window_start),
  constraint nearby_sighting_update_queue_status_check
    check (status in ('pending', 'processed', 'skipped', 'failed', 'dry_run'))
);

create unique index if not exists nearby_sighting_update_queue_report_window_idx
on public.nearby_sighting_update_queue(report_id, window_start);

create index if not exists nearby_sighting_update_queue_pending_idx
on public.nearby_sighting_update_queue(window_end, created_at)
where status = 'pending';

drop trigger if exists set_nearby_sighting_update_queue_updated_at on public.nearby_sighting_update_queue;
create trigger set_nearby_sighting_update_queue_updated_at
before update on public.nearby_sighting_update_queue
for each row
execute function public.set_updated_at();

create table if not exists public.report_sighting_update_clusters (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.pet_reports(id) on delete cascade,
  last_sighting_id uuid references public.sightings(id) on delete set null,
  mode text not null,
  lat double precision not null,
  lng double precision not null,
  zone_label text,
  confidence integer not null,
  sighting_count integer not null,
  window_start timestamptz,
  window_end timestamptz,
  data jsonb not null default '{}'::jsonb,
  notified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint report_sighting_update_clusters_mode_check
    check (mode in ('sent', 'dry_run')),
  constraint report_sighting_update_clusters_confidence_check
    check (confidence between 0 and 100),
  constraint report_sighting_update_clusters_count_check
    check (sighting_count > 0),
  constraint report_sighting_update_clusters_lat_check
    check (lat between -90 and 90),
  constraint report_sighting_update_clusters_lng_check
    check (lng between -180 and 180)
);

create index if not exists report_sighting_update_clusters_report_mode_notified_idx
on public.report_sighting_update_clusters(report_id, mode, notified_at desc);
