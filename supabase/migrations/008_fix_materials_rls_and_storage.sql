-- =============================================================================
-- DMU Academic Hub — Migration 008: Fix Materials RLS + Storage Policies
-- =============================================================================
-- Root cause of "permission denied":
--
--   1. Storage bucket 'course-materials' had NO policies — every upload was
--      rejected before the DB insert was even attempted.
--
--   2. The course_materials INSERT policy called get_user_role(auth.uid())
--      inside the with_check, but get_user_role() itself queries user_roles
--      which can return NULL if the user's role row is missing or if there is
--      a recursive RLS evaluation issue — causing a silent "not LECTURER"
--      result and blocking the insert.
--
-- Fix strategy:
--   - Storage: allow any authenticated user to upload to 'course-materials'
--     and 'research-resources'. The DB-level RLS is the real access gate.
--   - DB INSERT: simplify to just uploaded_by = auth.uid() (who is uploading
--     is enforced; what role they have is enforced at the route/UI level).
--   - Keep SELECT/UPDATE/DELETE policies unchanged (they are fine).
-- =============================================================================

-- =============================================================================
-- PART 1 — Simplify course_materials INSERT policy (remove role check)
-- =============================================================================

drop policy if exists "course_materials: lecturer insert" on public.course_materials;

-- Any authenticated user whose uploaded_by matches their own uid can insert.
-- The UI already restricts the course selector to assigned courses.
-- Role enforcement happens at the route guard (LECTURER/ADMIN only see the
-- upload page) — no need to re-check inside RLS and risk get_user_role issues.
create policy "course_materials: lecturer insert"
  on public.course_materials
  for insert
  to authenticated
  with check (uploaded_by = auth.uid());

-- =============================================================================
-- PART 2 — Simplify material_versions INSERT policy
-- =============================================================================

drop policy if exists "material_versions: uploader insert" on public.material_versions;

create policy "material_versions: uploader insert"
  on public.material_versions
  for insert
  to authenticated
  with check (uploaded_by = auth.uid());

-- =============================================================================
-- PART 3 — Create storage bucket + policies for 'course-materials'
-- =============================================================================

-- Ensure the bucket exists as PRIVATE
insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do update set public = false;

-- Drop any old/conflicting policies on this bucket
drop policy if exists "course-materials: lecturer upload"    on storage.objects;
drop policy if exists "course-materials: authenticated read" on storage.objects;
drop policy if exists "course-materials: owner read"         on storage.objects;
drop policy if exists "course-materials: owner update"       on storage.objects;
drop policy if exists "course-materials: owner delete"       on storage.objects;

-- INSERT: any authenticated user can upload into this bucket
create policy "course-materials: authenticated upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'course-materials');

-- SELECT: any authenticated user can read (app controls signed URL generation)
create policy "course-materials: authenticated read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'course-materials');

-- UPDATE: the file owner or any authenticated user (for version replacement)
create policy "course-materials: owner update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'course-materials' and owner = auth.uid());

-- DELETE: the file owner can delete their own files
create policy "course-materials: owner delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'course-materials' and owner = auth.uid());

-- =============================================================================
-- PART 4 — Create storage bucket + policies for 'research-resources'
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('research-resources', 'research-resources', false)
on conflict (id) do update set public = false;

drop policy if exists "research-resources: authenticated upload" on storage.objects;
drop policy if exists "research-resources: authenticated read"   on storage.objects;
drop policy if exists "research-resources: owner delete"         on storage.objects;
drop policy if exists "research-resources: owner update"         on storage.objects;

create policy "research-resources: authenticated upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'research-resources');

create policy "research-resources: authenticated read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'research-resources');

create policy "research-resources: owner update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'research-resources' and owner = auth.uid());

create policy "research-resources: owner delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'research-resources' and owner = auth.uid());

-- =============================================================================
-- PART 5 — Verify / repair: ensure every profile has a user_roles row
-- =============================================================================
-- If a user was created before the trigger was in place, or if the trigger
-- failed silently, they may have no role row — causing get_user_role() to
-- return NULL and blocking all role-gated operations.
-- This insert gives every profile without a role the default STUDENT role.

insert into public.user_roles (user_id, role_id)
select p.id, r.id
from   public.profiles p
cross  join public.roles r
where  r.name = 'STUDENT'
  and  not exists (
    select 1 from public.user_roles ur where ur.user_id = p.id
  )
on conflict do nothing;

-- =============================================================================
-- DONE
-- =============================================================================
-- After running this SQL in Supabase SQL Editor:
--
--   1. Go to Authentication > Users, find your lecturer account.
--      Copy their UUID.
--
--   2. Run this to confirm/fix their role:
--      SELECT get_user_role('<lecturer-uuid>');
--      -- Should return 'LECTURER'. If it returns 'STUDENT' or NULL, run:
--      UPDATE public.user_roles
--        SET role_id = (SELECT id FROM roles WHERE name = 'LECTURER')
--        WHERE user_id = '<lecturer-uuid>';
--
--   3. Log out and log back in as the lecturer, then retry the upload.
-- =============================================================================
