create table if not exists public.sighting_digest_queue (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.pet_reports(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  first_sighting_id uuid references public.sightings(id) on delete set null,
  last_sighting_id uuid references public.sightings(id) on delete set null,
  sighting_count integer not null default 0,
  status text not null default 'pending',
  reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sighting_digest_queue_window_check
    check (window_end > window_start),
  constraint sighting_digest_queue_count_check
    check (sighting_count >= 0),
  constraint sighting_digest_queue_status_check
    check (status in ('pending', 'processed', 'skipped', 'failed'))
);

create unique index if not exists sighting_digest_queue_report_window_idx
on public.sighting_digest_queue(report_id, window_start);

create index if not exists sighting_digest_queue_pending_idx
on public.sighting_digest_queue(window_end, created_at)
where status = 'pending';

drop trigger if exists set_sighting_digest_queue_updated_at on public.sighting_digest_queue;
create trigger set_sighting_digest_queue_updated_at
before update on public.sighting_digest_queue
for each row
execute function public.set_updated_at();

create table if not exists public.sighting_digest_items (
  digest_id uuid not null references public.sighting_digest_queue(id) on delete cascade,
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (digest_id, sighting_id)
);

create index if not exists sighting_digest_items_sighting_idx
on public.sighting_digest_items(sighting_id);
