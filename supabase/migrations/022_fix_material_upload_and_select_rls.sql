-- =============================================================================
-- DMU Academic Hub — Migration 022: Fix Course Materials RLS and Storage Policies
-- =============================================================================
-- Solves 403 (Forbidden) on POST /rest/v1/course_materials:
--
-- Root Cause:
-- 1. When Supabase inserts with .select(...), PostgREST runs an INSERT ... RETURNING query.
-- 2. PostgreSQL evaluates the table's SELECT RLS policy on the returned row.
-- 3. The old SELECT policy ("course_materials: access check") called can_access_material(id),
--    which executed `SELECT ... FROM public.course_materials WHERE id = p_material_id`.
--    During an INSERT, the in-flight row is NOT yet visible to separate queries inside
--    a STABLE function. Hence can_access_material(id) returned FALSE, causing Postgres
--    error 42501 (new row violates row-level security policy) -> 403 Forbidden.
-- 4. In addition, the INSERT policy requires a robust security definer helper to verify
--    the lecturer assignment without running into RLS recursion on user_roles or course_lecturers.
-- =============================================================================

-- 1. Security-definer helper to verify upload permission
create or replace function public.can_upload_course_material(p_course_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.user_roles user_role
      join public.roles role on role.id = user_role.role_id
      where user_role.user_id = auth.uid()
        and role.name = 'ACADEMIC_LIBRARY_ADMIN'
    )
    or (
      exists (
        select 1
        from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = auth.uid()
          and role.name = 'LECTURER'
      )
      and exists (
        select 1
        from public.course_lecturers assignment
        where assignment.course_id = p_course_id
          and assignment.lecturer_id = auth.uid()
      )
    );
$$;

revoke all on function public.can_upload_course_material(uuid) from public;
grant execute on function public.can_upload_course_material(uuid) to authenticated;

-- 2. Re-create the INSERT policy using the helper
drop policy if exists "course_materials: lecturer insert" on public.course_materials;
create policy "course_materials: lecturer insert"
  on public.course_materials
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_upload_course_material(course_id)
  );

-- 3. Fix the SELECT policy on course_materials:
-- Direct column evaluation instead of calling can_access_material(id) (which causes MVCC snapshot misses on insert)
drop policy if exists "course_materials: access check" on public.course_materials;
create policy "course_materials: access check"
  on public.course_materials
  for select
  using (
    -- The uploader can always select their own materials (including drafts and during INSERT ... RETURNING)
    (auth.uid() is not null and uploaded_by = auth.uid())
    -- Admins can view all materials
    or exists (
      select 1
      from public.user_roles user_role
      join public.roles role on role.id = user_role.role_id
      where user_role.user_id = auth.uid()
        and role.name = 'ACADEMIC_LIBRARY_ADMIN'
    )
    -- Other users can view active published materials according to visibility
    or (
      publication_status = 'PUBLISHED'
      and is_active = true
      and (
        visibility = 'PUBLIC'
        or (visibility = 'UNIVERSITY' and auth.uid() is not null)
        or (
          visibility = 'COURSE' and (
            public.is_enrolled_in_course(course_id)
            or public.is_assigned_to_course(course_id)
          )
        )
        or (
          visibility = 'DEPARTMENT' and exists (
            select 1 from public.profiles p
            join public.courses c on c.department_id = p.department_id
            where p.id = auth.uid() and c.id = course_id
          )
        )
      )
    )
  );

-- 4. Ensure private storage bucket and upload policies exist
insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do update set public = false;

drop policy if exists "course-materials: authenticated upload" on storage.objects;
create policy "course-materials: authenticated upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'course-materials');

drop policy if exists "course-materials: authenticated read" on storage.objects;
create policy "course-materials: authenticated read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'course-materials');

drop policy if exists "course-materials: owner update" on storage.objects;
create policy "course-materials: owner update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'course-materials' and owner = auth.uid());

drop policy if exists "course-materials: owner delete" on storage.objects;
create policy "course-materials: owner delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'course-materials' and owner = auth.uid());
