alter table public.pet_reports
  add column if not exists is_vulnerable boolean not null default false,
  add column if not exists is_urgent boolean not null default false,
  add column if not exists needs_medication boolean not null default false,
  add column if not exists pet_life_stage text not null default 'adult';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pet_reports_life_stage_check'
  ) then
    alter table public.pet_reports
      add constraint pet_reports_life_stage_check
      check (pet_life_stage in ('puppy', 'adult', 'senior'));
  end if;
end $$;

alter table public.sightings
  add column if not exists source_type text not null default 'normal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sightings_source_type_check'
  ) then
    alter table public.sightings
      add constraint sightings_source_type_check
      check (source_type in ('anonymous', 'normal', 'verified_business', 'rescuer', 'trusted'));
  end if;
end $$;
