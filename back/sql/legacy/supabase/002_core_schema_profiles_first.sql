create schema if not exists gis;
create extension if not exists postgis with schema gis;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text,
  username text unique,
  avatar_url text,
  bio text,
  phone text,
  city text,
  state text,
  country text not null default 'MX',
  is_public boolean not null default true
);

create table if not exists public.pet_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pet_name text not null,
  pet_type text not null,
  description text,
  zone text,
  last_seen_place text,
  last_seen_at timestamptz,
  last_seen_lat double precision not null,
  last_seen_lng double precision not null,
  reward_enabled boolean not null default false,
  reward_show_amount boolean not null default false,
  reward_amount numeric(10, 2),
  reward_currency text not null default 'MXN',
  contact_name text,
  preferred_contact text,
  contact_value text,
  public_whatsapp boolean not null default false,
  status text not null default 'active',
  manage_token text unique,
  manage_expires_at timestamptz,
  reunion_photo_url text,
  reunion_photo_url_2 text,
  reunion_message text,
  reunion_public_allowed boolean not null default false,
  constraint pet_reports_status_check
    check (status in ('active', 'reunited', 'archived')),
  constraint pet_reports_reward_amount_check
    check (reward_amount is null or reward_amount >= 0),
  constraint pet_reports_lat_check
    check (last_seen_lat between -90 and 90),
  constraint pet_reports_lng_check
    check (last_seen_lng between -180 and 180)
);

create table if not exists public.pet_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.pet_reports(id) on delete cascade,
  created_at timestamptz not null default now(),
  storage_bucket text not null default 'pet-photos',
  storage_path text not null,
  public_url text not null,
  content_type text,
  width integer,
  height integer,
  size_bytes integer,
  photo_type text not null default 'report',
  is_primary boolean not null default false,
  constraint pet_photos_photo_type_check
    check (photo_type in ('report', 'sighting', 'reunion')),
  constraint pet_photos_size_check
    check (size_bytes is null or size_bytes >= 0),
  constraint pet_photos_dimensions_check
    check (
      (width is null or width > 0)
      and (height is null or height > 0)
    )
);

create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid not null references public.pet_reports(id) on delete cascade,
  photo_id uuid references public.pet_photos(id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  comment text,
  contact_name text,
  status text not null default 'visible',
  is_useful boolean not null default false,
  trust_score integer not null default 40,
  constraint sightings_status_check
    check (status in ('visible', 'pending', 'hidden')),
  constraint sightings_trust_score_check
    check (trust_score between 0 and 100),
  constraint sightings_lat_check
    check (lat between -90 and 90),
  constraint sightings_lng_check
    check (lng between -180 and 180)
);

alter table public.sightings
add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

alter table public.sightings
add column if not exists photo_id uuid references public.pet_photos(id) on delete set null;

alter table public.sightings
add column if not exists seen_at timestamptz not null default now();

alter table public.sightings
add column if not exists status text not null default 'visible';

alter table public.sightings
add column if not exists is_useful boolean not null default false;

alter table public.sightings
add column if not exists trust_score integer not null default 40;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.pet_reports(id) on delete cascade,
  sighting_id uuid references public.sightings(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  constraint notifications_type_check
    check (type in ('nearby_report', 'nearby_sighting', 'report_update', 'system'))
);

create unique index if not exists pet_photos_one_primary_report_photo_idx
on public.pet_photos(report_id)
where is_primary = true
  and photo_type = 'report'
  and report_id is not null;

create index if not exists profiles_username_idx
on public.profiles(username);

create index if not exists pet_reports_profile_created_idx
on public.pet_reports(profile_id, created_at desc);

create index if not exists pet_reports_active_created_idx
on public.pet_reports(created_at desc)
where status = 'active';

create index if not exists pet_reports_last_seen_geog_idx
on public.pet_reports
using gist (
  (gis.st_setsrid(gis.st_point(last_seen_lng, last_seen_lat), 4326)::gis.geography)
)
where status = 'active';

create index if not exists pet_photos_profile_created_idx
on public.pet_photos(profile_id, created_at desc);

create index if not exists pet_photos_report_idx
on public.pet_photos(report_id);

create index if not exists sightings_report_seen_at_idx
on public.sightings(report_id, seen_at desc)
where status in ('visible', 'pending');

create index if not exists sightings_profile_created_idx
on public.sightings(profile_id, created_at desc);

create index if not exists sightings_seen_geog_idx
on public.sightings
using gist (
  (gis.st_setsrid(gis.st_point(lng, lat), 4326)::gis.geography)
)
where status in ('visible', 'pending');

create index if not exists notifications_profile_created_idx
on public.notifications(profile_id, created_at desc);

create index if not exists notifications_profile_unread_idx
on public.notifications(profile_id, created_at desc)
where read_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_pet_reports_updated_at on public.pet_reports;
create trigger set_pet_reports_updated_at
before update on public.pet_reports
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.pet_reports enable row level security;
alter table public.pet_photos enable row level security;
alter table public.sightings enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
on public.profiles
for select
using (is_public = true or auth.uid() = id);

drop policy if exists "Users can manage their profile" on public.profiles;
create policy "Users can manage their profile"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Active pet reports are publicly readable" on public.pet_reports;
create policy "Active pet reports are publicly readable"
on public.pet_reports
for select
using (status = 'active' or auth.uid() = profile_id);

drop policy if exists "Users can create pet reports from their profile" on public.pet_reports;
create policy "Users can create pet reports from their profile"
on public.pet_reports
for insert
with check (auth.uid() = profile_id);

drop policy if exists "Users can manage their pet reports" on public.pet_reports;
create policy "Users can manage their pet reports"
on public.pet_reports
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "Users can delete their pet reports" on public.pet_reports;
create policy "Users can delete their pet reports"
on public.pet_reports
for delete
using (auth.uid() = profile_id);

drop policy if exists "Pet photos are publicly readable for active reports" on public.pet_photos;
create policy "Pet photos are publicly readable for active reports"
on public.pet_photos
for select
using (
  exists (
    select 1
    from public.pet_reports r
    where r.id = pet_photos.report_id
      and (r.status = 'active' or auth.uid() = r.profile_id)
  )
  or auth.uid() = profile_id
);

drop policy if exists "Users can manage their pet photos" on public.pet_photos;
create policy "Users can manage their pet photos"
on public.pet_photos
for all
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "Visible sightings are publicly readable" on public.sightings;
create policy "Visible sightings are publicly readable"
on public.sightings
for select
using (status in ('visible', 'pending') or auth.uid() = profile_id);

drop policy if exists "Users can create sightings from their profile" on public.sightings;
create policy "Users can create sightings from their profile"
on public.sightings
for insert
with check (auth.uid() = profile_id);

drop policy if exists "Users can manage their sightings" on public.sightings;
create policy "Users can manage their sightings"
on public.sightings
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications"
on public.notifications
for select
using (auth.uid() = profile_id);

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications"
on public.notifications
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);
