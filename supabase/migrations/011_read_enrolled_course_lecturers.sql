-- Let students see the lecturer details for courses in which they are actively
-- enrolled. Course assignment records remain read-only to application users.

drop policy if exists "course_lecturers: enrolled student read" on public.course_lecturers;
create policy "course_lecturers: enrolled student read"
  on public.course_lecturers for select
  using (public.is_enrolled_in_course(course_id));
