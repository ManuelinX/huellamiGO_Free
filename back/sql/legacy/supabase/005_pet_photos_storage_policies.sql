insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do update
set public = true;

drop policy if exists "Pet photos are publicly readable" on storage.objects;
create policy "Pet photos are publicly readable"
on storage.objects
for select
using (bucket_id = 'pet-photos');

drop policy if exists "Authenticated users can upload pet photos" on storage.objects;
create policy "Authenticated users can upload pet photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their pet photos" on storage.objects;
create policy "Users can update their pet photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their pet photos" on storage.objects;
create policy "Users can delete their pet photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
