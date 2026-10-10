drop function if exists public.get_managed_report(uuid, text);

create or replace function public.get_managed_report(
  report_id_input uuid,
  manage_token_input text
)
returns setof public.pet_reports
language sql
security definer
set search_path = public
as $$
  select *
  from public.pet_reports
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

drop function if exists public.get_public_reunion_stories();

create or replace function public.get_public_reunion_stories()
returns setof public.pet_reports
language sql
security definer
set search_path = public
as $$
  select *
  from public.pet_reports
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
drop function if exists public.update_managed_report_status(uuid, text, text, text, text, text, boolean);

create or replace function public.update_managed_report_status(
  report_id_input uuid,
  manage_token_input text,
  status_input text,
  reunion_photo_url_input text default null,
  reunion_photo_url_2_input text default null,
  reunion_message_input text default null,
  reunion_public_allowed_input boolean default false
)
returns setof public.pet_reports
language sql
security definer
set search_path = public
as $$
  update public.pet_reports
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
      from public.pet_reports
      where id = report_id_input
        and manage_token = manage_token_input
        and status <> 'archived'
    )
  returning *;
$$;

grant execute on function public.get_managed_report(uuid, text) to anon;
grant execute on function public.get_public_reunion_stories() to anon;
grant execute on function public.update_managed_report_status(uuid, text, text, text, text, text, boolean) to anon;
grant execute on function public.update_managed_sighting(uuid, text, uuid, text, boolean) to anon;
