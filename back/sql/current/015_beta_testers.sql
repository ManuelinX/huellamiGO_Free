create table if not exists public.beta_testers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invited_by_email text,
  source text not null default 'qr',
  status text not null default 'active',
  constraint beta_testers_status_check
    check (status in ('active', 'revoked')),
  constraint beta_testers_source_check
    check (source in ('qr', 'manual', 'env_import'))
);

create unique index if not exists beta_testers_email_lower_idx
on public.beta_testers(lower(email));

drop trigger if exists set_beta_testers_updated_at on public.beta_testers;
create trigger set_beta_testers_updated_at
before update on public.beta_testers
for each row
execute function public.set_updated_at();
