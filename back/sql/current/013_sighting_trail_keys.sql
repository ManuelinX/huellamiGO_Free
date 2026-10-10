alter table public.sightings
add column if not exists is_trail_key boolean not null default false;

update public.sightings
set is_trail_key = false
where status = 'hidden'
  and is_trail_key = true;

create index if not exists sightings_report_trail_key_seen_idx
on public.sightings(report_id, seen_at asc)
where is_trail_key = true
  and status in ('visible', 'pending');
