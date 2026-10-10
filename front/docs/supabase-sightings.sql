create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_id uuid not null references public.lost_pet_reports(id) on delete cascade,
  seen_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  comment text,
  contact_name text,
  photo_url text,
  status text not null default 'visible',
  is_useful boolean not null default false,
  trust_score integer not null default 40
);

alter table public.sightings
add column if not exists status text not null default 'visible';

alter table public.sightings
add column if not exists trust_score integer not null default 40;

alter table public.sightings
add column if not exists is_useful boolean not null default false;

create or replace function public.update_managed_sighting(
  report_id_input uuid,
  manage_token_input text,
  sighting_id_input uuid,
  status_input text,
  is_useful_input boolean
)
returns setof public.sightings
language sql
security definer
set search_path = public
as $$
  update public.sightings
  set
    status = status_input,
    is_useful = is_useful_input
  where id = sighting_id_input
    and report_id = report_id_input
    and status_input in ('visible', 'pending', 'hidden')
    and exists (
      select 1
      from public.lost_pet_reports
      where id = report_id_input
        and manage_token = manage_token_input
        and status <> 'archived'
    )
  returning *;
$$;

grant execute on function public.update_managed_sighting(uuid, text, uuid, text, boolean) to anon;

alter table public.sightings enable row level security;

create policy "Anyone can read sightings"
on public.sightings
for select
to anon
using (true);

create policy "Anyone can create sightings"
on public.sightings
for insert
to anon
with check (true);
