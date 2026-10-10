alter table public.sightings
  add column if not exists created_ip text;

create index if not exists sightings_profile_report_created_idx
on public.sightings(profile_id, report_id, created_at desc);

create index if not exists sightings_created_ip_report_created_idx
on public.sightings(created_ip, report_id, created_at desc)
where created_ip is not null;

create index if not exists sightings_created_ip_created_idx
on public.sightings(created_ip, created_at desc)
where created_ip is not null;
