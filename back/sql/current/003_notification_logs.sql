create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.pet_reports(id) on delete cascade,
  sighting_id uuid references public.sightings(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  notification_type text not null,
  channel text not null default 'in_app',
  dedupe_key text not null,
  status text not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notification_logs_channel_check
    check (channel in ('in_app', 'web_push', 'email')),
  constraint notification_logs_status_check
    check (status in ('pending', 'sent', 'skipped', 'failed'))
);

create unique index if not exists notification_logs_profile_channel_dedupe_idx
on public.notification_logs(profile_id, channel, dedupe_key);

create index if not exists notification_logs_profile_created_idx
on public.notification_logs(profile_id, created_at desc);

create index if not exists notification_logs_report_created_idx
on public.notification_logs(report_id, created_at desc)
where report_id is not null;
