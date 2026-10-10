create schema if not exists gis;
create extension if not exists pgcrypto;
create extension if not exists postgis with schema gis;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  password_hash text not null,
  display_name text,
  email_verified_at timestamptz,
  email_verification_sent_at timestamptz,
  status text not null default 'active',
  constraint app_users_status_check
    check (status in ('active', 'disabled'))
);

create unique index if not exists app_users_email_lower_idx
on public.app_users(lower(email));

create table if not exists public.profiles (
  id uuid primary key references public.app_users(id) on delete cascade,
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
  is_vulnerable boolean not null default false,
  is_urgent boolean not null default false,
  needs_medication boolean not null default false,
  pet_life_stage text not null default 'adult',
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
  constraint pet_reports_life_stage_check
    check (pet_life_stage in ('puppy', 'adult', 'senior')),
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
  profile_id uuid references public.profiles(id) on delete cascade,
  report_id uuid not null references public.pet_reports(id) on delete cascade,
  photo_id uuid references public.pet_photos(id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  comment text,
  contact_name text,
  photo_url text,
  created_ip text,
  status text not null default 'visible',
  is_useful boolean not null default false,
  is_trail_key boolean not null default false,
  trust_score integer not null default 40,
  source_type text not null default 'normal',
  constraint sightings_status_check
    check (status in ('visible', 'pending', 'hidden')),
  constraint sightings_trust_score_check
    check (trust_score between 0 and 100),
  constraint sightings_source_type_check
    check (source_type in ('anonymous', 'normal', 'verified_business', 'rescuer', 'trusted')),
  constraint sightings_lat_check
    check (lat between -90 and 90),
  constraint sightings_lng_check
    check (lng between -180 and 180)
);

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
    check (note is null or char_length(note) <= 48),
  constraint reviewed_search_zones_radius_check
    check (radius_m between 50 and 5000),
  constraint reviewed_search_zones_lat_check
    check (lat between -90 and 90),
  constraint reviewed_search_zones_lng_check
    check (lng between -180 and 180)
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_ip text,
  user_agent text
);

create table if not exists public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_ip text,
  user_agent text
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

create index if not exists pet_reports_status_location_idx
on public.pet_reports(status, last_seen_lat, last_seen_lng)
where last_seen_lat is not null
  and last_seen_lng is not null;

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

create index if not exists sightings_profile_report_created_idx
on public.sightings(profile_id, report_id, created_at desc);

create index if not exists sightings_created_ip_report_created_idx
on public.sightings(created_ip, report_id, created_at desc)
where created_ip is not null;

create index if not exists sightings_created_ip_created_idx
on public.sightings(created_ip, created_at desc)
where created_ip is not null;

create index if not exists sightings_seen_geog_idx
on public.sightings
using gist (
  (gis.st_setsrid(gis.st_point(lng, lat), 4326)::gis.geography)
)
where status in ('visible', 'pending');

create index if not exists reviewed_search_zones_report_checked_idx
on public.reviewed_search_zones(report_id, checked_at desc);

create index if not exists notifications_profile_created_idx
on public.notifications(profile_id, created_at desc);

create index if not exists notifications_profile_unread_idx
on public.notifications(profile_id, created_at desc)
where read_at is null;

create index if not exists password_reset_tokens_user_created_idx
on public.password_reset_tokens(user_id, created_at desc);

create index if not exists password_reset_tokens_active_hash_idx
on public.password_reset_tokens(token_hash)
where used_at is null;

create index if not exists email_verification_tokens_user_created_idx
on public.email_verification_tokens(user_id, created_at desc);

create index if not exists email_verification_tokens_active_hash_idx
on public.email_verification_tokens(token_hash)
where used_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
before update on public.app_users
for each row
execute function public.set_updated_at();

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
