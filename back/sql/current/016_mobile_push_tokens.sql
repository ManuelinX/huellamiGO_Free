create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  device_id text,
  app_version text,
  disabled_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_push_tokens_platform_check
    check (platform in ('android', 'ios'))
);

create index if not exists mobile_push_tokens_profile_active_idx
on public.mobile_push_tokens(profile_id, updated_at desc)
where disabled_at is null;

drop trigger if exists set_mobile_push_tokens_updated_at on public.mobile_push_tokens;
create trigger set_mobile_push_tokens_updated_at
before update on public.mobile_push_tokens
for each row
execute function public.set_updated_at();

alter table public.notification_logs
  drop constraint if exists notification_logs_channel_check;

alter table public.notification_logs
  add constraint notification_logs_channel_check
  check (channel in ('in_app', 'web_push', 'mobile_push', 'email'));
