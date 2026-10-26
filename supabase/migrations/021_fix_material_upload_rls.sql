-- Check uploader role and lecturer assignment in one security-definer helper.
-- This avoids relying on get_user_role()'s single-row result inside RLS.

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

drop policy if exists "course_materials: lecturer insert" on public.course_materials;
create policy "course_materials: lecturer insert"
  on public.course_materials
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_upload_course_material(course_id)
  );
