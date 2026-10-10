create table if not exists public.app_presence (
  visitor_id text primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text
);

create index if not exists app_presence_last_seen_idx
on public.app_presence(last_seen_at desc);

create index if not exists app_presence_profile_last_seen_idx
on public.app_presence(profile_id, last_seen_at desc)
where profile_id is not null;
