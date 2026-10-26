-- Restore server-side checks for lecturer role and course assignment.
-- Migration 008 simplified the insert policy to authenticated ownership only.

drop policy if exists "course_materials: lecturer insert" on public.course_materials;
create policy "course_materials: lecturer insert"
  on public.course_materials
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
      or (
        public.get_user_role(auth.uid()) = 'LECTURER'
        and public.is_assigned_to_course(course_id)
      )
    )
  );
