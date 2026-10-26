-- =============================================================================
-- DMU Academic Hub — Migration 002: Read-only Academic Reference Data
-- =============================================================================
-- Run this AFTER 001_rbac_foundation.sql
-- =============================================================================

-- =============================================================================
-- SECTION 1: ACADEMIC REFERENCE TABLES
-- =============================================================================

-- 1.1 Colleges / Schools (reference data managed outside this platform)
create table if not exists public.colleges (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  code        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.colleges is 'Read-only reference data for DMU colleges and schools.';

-- 1.2 Departments
create table if not exists public.departments (
  id          uuid primary key default uuid_generate_v4(),
  college_id  uuid not null references public.colleges(id) on delete restrict,
  name        text not null,
  code        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(college_id, name)
);

comment on table public.departments is 'Read-only reference data for academic departments.';

-- 1.3 Programs (degree programs)
create table if not exists public.programs (
  id            uuid primary key default uuid_generate_v4(),
  department_id uuid not null references public.departments(id) on delete restrict,
  name          text not null,
  code          text not null unique,
  degree_type   text not null default 'UNDERGRADUATE'
                  check (degree_type in ('UNDERGRADUATE','POSTGRADUATE','DIPLOMA','CERTIFICATE')),
  duration_years int not null default 4,
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(department_id, name)
);

comment on table public.programs is 'Read-only reference data for programs used to classify research.';

-- 1.4 Academic Years
create table if not exists public.academic_years (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,   -- e.g. "2023/2024"
  start_date date not null,
  end_date   date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.academic_years is 'Read-only academic-year reference data.';

-- 1.5 Semesters
create table if not exists public.semesters (
  id               uuid primary key default uuid_generate_v4(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name             text not null,    -- e.g. "Semester I"
  semester_number  int  not null check (semester_number in (1,2)),
  start_date       date,
  end_date         date,
  is_current       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(academic_year_id, semester_number)
);

comment on table public.semesters is 'Read-only semester reference data.';

-- 1.6 Courses
create table if not exists public.courses (
  id               uuid primary key default uuid_generate_v4(),
  department_id    uuid not null references public.departments(id) on delete restrict,
  program_id       uuid references public.programs(id) on delete set null,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  semester_id      uuid not null references public.semesters(id) on delete restrict,
  name             text not null,
  code             text not null,
  credit_hours     int  not null default 3,
  year_level       int  not null default 1 check (year_level between 1 and 6),
  description      text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(code, academic_year_id, semester_id)
);

comment on table public.courses is 'Read-only course reference data used to organize learning materials.';

-- 1.7 Course ↔ Lecturer assignments
create table if not exists public.course_lecturers (
  id          uuid primary key default uuid_generate_v4(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  lecturer_id uuid not null references public.profiles(id) on delete cascade,
  is_primary  boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique(course_id, lecturer_id)
);

comment on table public.course_lecturers is 'Assigns lecturers to courses. Used for upload authorization.';

-- 1.8 Course ↔ Student enrollments
create table if not exists public.course_enrollments (
  id            uuid primary key default uuid_generate_v4(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  enrolled_at   timestamptz not null default now(),
  enrolled_by   uuid references public.profiles(id) on delete set null,
  status        text not null default 'ACTIVE'
                  check (status in ('ACTIVE','DROPPED','COMPLETED')),
  unique(course_id, student_id)
);

comment on table public.course_enrollments is 'Student enrollments. Used to authorize material access.';

-- =============================================================================
-- SECTION 2: ADD FOREIGN KEYS TO PROFILES (now that departments exists)
-- =============================================================================

alter table public.profiles
  add column if not exists college_id uuid references public.colleges(id) on delete set null;

-- department_id and program_id were added as plain uuids in migration 001,
-- now add the foreign key constraints
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_department_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_department_id_fkey
      foreign key (department_id) references public.departments(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_program_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_program_id_fkey
      foreign key (program_id) references public.programs(id) on delete set null;
  end if;
end $$;

-- =============================================================================
-- SECTION 3: INDEXES
-- =============================================================================

create index if not exists idx_departments_college_id        on public.departments(college_id);
create index if not exists idx_programs_department_id        on public.programs(department_id);
create index if not exists idx_semesters_academic_year_id    on public.semesters(academic_year_id);
create index if not exists idx_courses_department_id         on public.courses(department_id);
create index if not exists idx_courses_semester_id           on public.courses(semester_id);
create index if not exists idx_courses_academic_year_id      on public.courses(academic_year_id);
create index if not exists idx_course_lecturers_course_id    on public.course_lecturers(course_id);
create index if not exists idx_course_lecturers_lecturer_id  on public.course_lecturers(lecturer_id);
create index if not exists idx_course_enrollments_course_id  on public.course_enrollments(course_id);
create index if not exists idx_course_enrollments_student_id on public.course_enrollments(student_id);

-- =============================================================================
-- SECTION 4: UPDATED_AT TRIGGERS
-- =============================================================================

do $$ declare
  t text;
begin
  foreach t in array array[
    'colleges','departments','programs',
    'academic_years','semesters','courses'
  ] loop
    execute format('
      drop trigger if exists %I_updated_at on public.%I;
      create trigger %I_updated_at
        before update on public.%I
        for each row execute function public.handle_updated_at();
    ', t, t, t, t);
  end loop;
end $$;

-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- =============================================================================

alter table public.colleges           enable row level security;
alter table public.departments        enable row level security;
alter table public.programs           enable row level security;
alter table public.academic_years     enable row level security;
alter table public.semesters          enable row level security;
alter table public.courses            enable row level security;
alter table public.course_lecturers   enable row level security;
alter table public.course_enrollments enable row level security;

-- ── colleges ─────────────────────────────────────────────────────────────────
create policy "colleges: authenticated read"
  on public.colleges for select to authenticated using (true);

-- ── departments ──────────────────────────────────────────────────────────────
create policy "departments: authenticated read"
  on public.departments for select to authenticated using (true);

-- ── programs ─────────────────────────────────────────────────────────────────
create policy "programs: authenticated read"
  on public.programs for select to authenticated using (true);

-- ── academic_years ───────────────────────────────────────────────────────────
create policy "academic_years: authenticated read"
  on public.academic_years for select to authenticated using (true);

-- ── semesters ────────────────────────────────────────────────────────────────
create policy "semesters: authenticated read"
  on public.semesters for select to authenticated using (true);

-- ── courses ──────────────────────────────────────────────────────────────────
-- Courses are read-only references for organizing learning materials.
create policy "courses: authenticated read"
  on public.courses for select to authenticated using (true);

-- ── course_lecturers ─────────────────────────────────────────────────────────
-- Assignment references support lecturer material authorization.
create policy "course_lecturers: own read"
  on public.course_lecturers for select
  using (lecturer_id = auth.uid() or public.is_admin());

-- ── course_enrollments ───────────────────────────────────────────────────────
-- Enrollment references authorize access to course materials; the platform
-- does not create or manage these records.
create policy "course_enrollments: student own read"
  on public.course_enrollments for select
  using (student_id = auth.uid());

create policy "course_enrollments: lecturer read"
  on public.course_enrollments for select
  using (
    exists (
      select 1 from public.course_lecturers cl
      where cl.course_id   = course_enrollments.course_id
        and cl.lecturer_id = auth.uid()
    )
  );

create policy "course_enrollments: admin read"
  on public.course_enrollments for select
  using (public.is_admin());

-- =============================================================================
-- SECTION 6: SEED — DMU SAMPLE DATA
-- =============================================================================

-- Colleges
insert into public.colleges (name, code, description) values
  ('College of Computing and Informatics',      'CCI',  'Computing, IT, and software engineering programs'),
  ('College of Business and Economics',         'CBE',  'Business, accounting, and economics programs'),
  ('College of Engineering and Technology',     'CET',  'Civil, electrical, and mechanical engineering'),
  ('College of Natural and Computational Sciences', 'CNCS', 'Mathematics, physics, chemistry, biology'),
  ('College of Social Sciences and Humanities', 'CSSH', 'History, geography, psychology, civics'),
  ('College of Education',                      'COE',  'Teacher training and education programs'),
  ('College of Agriculture',                    'COA',  'Agricultural sciences and natural resources'),
  ('College of Medicine and Health Sciences',   'CMHS', 'Medicine, nursing, and public health')
on conflict (code) do nothing;

-- Departments (CCI)
insert into public.departments (college_id, name, code) values
  ((select id from public.colleges where code='CCI'), 'Software Engineering',        'SE'),
  ((select id from public.colleges where code='CCI'), 'Information Technology',      'IT'),
  ((select id from public.colleges where code='CCI'), 'Computer Science',            'CS'),
  ((select id from public.colleges where code='CBE'), 'Accounting and Finance',      'AF'),
  ((select id from public.colleges where code='CBE'), 'Management',                  'MGT'),
  ((select id from public.colleges where code='CBE'), 'Economics',                   'ECON'),
  ((select id from public.colleges where code='CET'), 'Civil Engineering',           'CE'),
  ((select id from public.colleges where code='CET'), 'Electrical Engineering',      'EE'),
  ((select id from public.colleges where code='CNCS'),'Mathematics',                 'MATH'),
  ((select id from public.colleges where code='CNCS'),'Physics',                     'PHY')
on conflict (code) do nothing;

-- Programs
insert into public.programs (department_id, name, code, degree_type, duration_years) values
  ((select id from public.departments where code='SE'),   'BSc Software Engineering',    'BSC-SE',   'UNDERGRADUATE', 4),
  ((select id from public.departments where code='IT'),   'BSc Information Technology',  'BSC-IT',   'UNDERGRADUATE', 4),
  ((select id from public.departments where code='CS'),   'BSc Computer Science',        'BSC-CS',   'UNDERGRADUATE', 4),
  ((select id from public.departments where code='AF'),   'BA Accounting and Finance',   'BA-AF',    'UNDERGRADUATE', 4),
  ((select id from public.departments where code='MGT'),  'BA Management',               'BA-MGT',   'UNDERGRADUATE', 4),
  ((select id from public.departments where code='CE'),   'BSc Civil Engineering',       'BSC-CE',   'UNDERGRADUATE', 5),
  ((select id from public.departments where code='EE'),   'BSc Electrical Engineering',  'BSC-EE',   'UNDERGRADUATE', 5),
  ((select id from public.departments where code='MATH'), 'BSc Mathematics',             'BSC-MATH', 'UNDERGRADUATE', 4)
on conflict (code) do nothing;

-- Academic Year
insert into public.academic_years (name, start_date, end_date, is_current) values
  ('2023/2024', '2023-09-01', '2024-06-30', false),
  ('2024/2025', '2024-09-01', '2025-06-30', false),
  ('2025/2026', '2025-09-01', '2026-06-30', true)
on conflict (name) do nothing;

-- Semesters for current year
insert into public.semesters (academic_year_id, name, semester_number, start_date, end_date, is_current)
select
  id,
  'Semester I',
  1,
  start_date,
  start_date + interval '4 months',
  (name = '2025/2026')
from public.academic_years where name = '2025/2026'
on conflict (academic_year_id, semester_number) do nothing;

insert into public.semesters (academic_year_id, name, semester_number, start_date, end_date, is_current)
select
  id,
  'Semester II',
  2,
  start_date + interval '4 months' + interval '1 day',
  end_date,
  false
from public.academic_years where name = '2025/2026'
on conflict (academic_year_id, semester_number) do nothing;

-- Sample courses for SE Year 2 Semester I 2025/2026
insert into public.courses (department_id, program_id, academic_year_id, semester_id, name, code, credit_hours, year_level)
select
  d.id,
  p.id,
  ay.id,
  s.id,
  c.name,
  c.code,
  c.credit_hours,
  c.year_level
from (values
  ('Database Systems',             'DB-SYS-201',   3, 2),
  ('Object-Oriented Programming',  'OOP-202',      3, 2),
  ('Data Structures & Algorithms', 'DSA-203',      3, 2),
  ('Computer Networks',            'CN-204',       3, 2),
  ('Software Engineering I',       'SE-205',       3, 2)
) as c(name, code, credit_hours, year_level)
cross join public.departments d
cross join public.programs p
cross join public.academic_years ay
cross join public.semesters s
where d.code  = 'SE'
  and p.code  = 'BSC-SE'
  and ay.name = '2025/2026'
  and s.semester_number = 1
on conflict do nothing;

-- =============================================================================
-- DONE
-- =============================================================================
