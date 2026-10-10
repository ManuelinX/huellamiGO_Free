create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  notify_sighting_updates boolean not null default true,
  notify_nearby_reports boolean not null default true,
  radius_km numeric(5, 2) not null default 3,
  alert_lat double precision,
  alert_lng double precision,
  alert_place_label text,
  location_source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_radius_check
    check (radius_km between 0.2 and 50),
  constraint notification_preferences_alert_lat_check
    check (alert_lat is null or alert_lat between -90 and 90),
  constraint notification_preferences_alert_lng_check
    check (alert_lng is null or alert_lng between -180 and 180),
  constraint notification_preferences_location_source_check
    check (location_source in ('auto', 'manual'))
);

alter table public.notification_preferences
  add column if not exists alert_lat double precision,
  add column if not exists alert_lng double precision,
  add column if not exists alert_place_label text,
  add column if not exists location_source text not null default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_preferences_alert_lat_check'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_alert_lat_check
      check (alert_lat is null or alert_lat between -90 and 90);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_preferences_alert_lng_check'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_alert_lng_check
      check (alert_lng is null or alert_lng between -180 and 180);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_preferences_location_source_check'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_location_source_check
      check (location_source in ('auto', 'manual'));
  end if;
end $$;

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at();
