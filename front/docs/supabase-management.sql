alter table public.lost_pet_reports
add column if not exists manage_token text;

alter table public.lost_pet_reports
add column if not exists manage_expires_at timestamptz;

alter table public.lost_pet_reports
add column if not exists reunion_photo_url text;

alter table public.lost_pet_reports
add column if not exists reunion_photo_url_2 text;

alter table public.lost_pet_reports
add column if not exists reunion_message text;

alter table public.lost_pet_reports
add column if not exists reunion_public_allowed boolean not null default false;

create or replace function public.get_managed_report(
  report_id_input uuid,
  manage_token_input text
)
returns setof public.lost_pet_reports
language sql
security definer
set search_path = public
as $$
  select *
  from public.lost_pet_reports
  where id = report_id_input
    and manage_token = manage_token_input
    and status <> 'archived'
    and (
      status <> 'reunited'
      or manage_expires_at is null
      or manage_expires_at > now()
    )
  limit 1;
$$;

create or replace function public.get_public_reunion_stories()
returns setof public.lost_pet_reports
language sql
security definer
set search_path = public
as $$
  select *
  from public.lost_pet_reports
  where status = 'reunited'
    and reunion_public_allowed = true
    and (
      reunion_message is not null
      or reunion_photo_url is not null
      or reunion_photo_url_2 is not null
    )
  order by created_at desc
  limit 3;
$$;

drop function if exists public.update_managed_report_status(uuid, text, text);
drop function if exists public.update_managed_report_status(uuid, text, text, text, text, boolean);

create or replace function public.update_managed_report_status(
  report_id_input uuid,
  manage_token_input text,
  status_input text,
  reunion_photo_url_input text default null,
  reunion_photo_url_2_input text default null,
  reunion_message_input text default null,
  reunion_public_allowed_input boolean default false
)
returns setof public.lost_pet_reports
language sql
security definer
set search_path = public
as $$
  update public.lost_pet_reports
  set
    status = status_input,
    manage_token = case
      when status_input = 'archived' then null
      else manage_token
    end,
    manage_expires_at = case
      when status_input = 'reunited' then now() + interval '7 days'
      when status_input in ('active', 'archived') then null
      else manage_expires_at
    end,
    reunion_photo_url = case
      when status_input = 'reunited' then reunion_photo_url_input
      when status_input = 'active' then null
      else reunion_photo_url
    end,
    reunion_photo_url_2 = case
      when status_input = 'reunited' then reunion_photo_url_2_input
      when status_input = 'active' then null
      else reunion_photo_url_2
    end,
    reunion_message = case
      when status_input = 'reunited' then nullif(left(reunion_message_input, 180), '')
      when status_input = 'active' then null
      else reunion_message
    end,
    reunion_public_allowed = case
      when status_input = 'reunited' then reunion_public_allowed_input
      when status_input = 'active' then false
      else reunion_public_allowed
    end
  where id = report_id_input
    and manage_token = manage_token_input
    and status_input in ('active', 'reunited', 'archived')
  returning *;
$$;

grant execute on function public.get_managed_report(uuid, text) to anon;
grant execute on function public.get_public_reunion_stories() to anon;
grant execute on function public.update_managed_report_status(uuid, text, text, text, text, text, boolean) to anon;
