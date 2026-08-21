-- Phase 0 · Migration 8: storage buckets + policies (PRD §11.7, SEC-28–SEC-33)

-- resumes: private; anon and members have NO read/write. Writes happen only via
-- the service-role /apply Route Handler (Track B2); committee/board reads via
-- server-minted signed URLs (1h TTL). Path: resumes/{candidate_id}/{uuid}.pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf']);

-- member-photos: private; members upload only into their own folder
-- (member-photos/{member_id}/…); board uploads anywhere; reads via signed URLs
-- (24h TTL) minted server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- storage.objects policies. No resumes INSERT/UPDATE/DELETE policies exist for
-- any user role — service_role bypasses RLS, which is the only write path.
-- list/select on resumes is board-only (SEC-30: committee holds signed URLs but
-- cannot enumerate paths).
create policy storage_resumes_board_select on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (select public.is_board()));

create policy storage_member_photos_member_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'member-photos'
    and (
      (select public.is_board())
      or (storage.foldername(name))[1] = (select public.current_member_id())::text
    )
  );

create policy storage_member_photos_member_update on storage.objects for update to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      (select public.is_board())
      or (storage.foldername(name))[1] = (select public.current_member_id())::text
    )
  )
  with check (
    bucket_id = 'member-photos'
    and (
      (select public.is_board())
      or (storage.foldername(name))[1] = (select public.current_member_id())::text
    )
  );

create policy storage_member_photos_member_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      (select public.is_board())
      or (storage.foldername(name))[1] = (select public.current_member_id())::text
    )
  );

-- Members may list/read their own photo objects; public reads happen via
-- signed URLs minted server-side for is_public members.
create policy storage_member_photos_member_select on storage.objects for select to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      (select public.is_board())
      or (storage.foldername(name))[1] = (select public.current_member_id())::text
    )
  );
;
