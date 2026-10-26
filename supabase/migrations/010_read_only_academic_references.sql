-- Academic reference records support content organization and access checks.
-- Their source of truth is outside this platform, so application roles are
-- limited to read access.

drop policy if exists "colleges: admin write" on public.colleges;
drop policy if exists "departments: admin write" on public.departments;
drop policy if exists "programs: admin write" on public.programs;
drop policy if exists "academic_years: admin write" on public.academic_years;
drop policy if exists "semesters: admin write" on public.semesters;
drop policy if exists "courses: admin write" on public.courses;
drop policy if exists "course_lecturers: admin write" on public.course_lecturers;
drop policy if exists "course_enrollments: admin all" on public.course_enrollments;

drop policy if exists "course_lecturers: admin read" on public.course_lecturers;
create policy "course_lecturers: admin read"
  on public.course_lecturers for select
  using (public.is_admin());

drop policy if exists "course_enrollments: admin read" on public.course_enrollments;
create policy "course_enrollments: admin read"
  on public.course_enrollments for select
  using (public.is_admin());

delete from public.role_permissions
where permission_id in (
  select id
  from public.permissions
  where name in (
    'MANAGE_COLLEGE',
    'MANAGE_DEPARTMENT',
    'MANAGE_PROGRAM',
    'MANAGE_ACADEMIC_YEAR',
    'MANAGE_SEMESTER',
    'MANAGE_COURSE',
    'MANAGE_COURSE_ASSIGNMENT',
    'MANAGE_ENROLLMENT'
  )
);

delete from public.permissions
where name in (
  'MANAGE_COLLEGE',
  'MANAGE_DEPARTMENT',
  'MANAGE_PROGRAM',
  'MANAGE_ACADEMIC_YEAR',
  'MANAGE_SEMESTER',
  'MANAGE_COURSE',
  'MANAGE_COURSE_ASSIGNMENT',
  'MANAGE_ENROLLMENT'
);

update public.roles
set display_name = 'Academic Resource & Library Administrator'
where name = 'ACADEMIC_LIBRARY_ADMIN';
