-- =============================================================================
-- DMU Academic Hub — Migration 004: Digital Course Materials
-- =============================================================================
-- Run this AFTER 002_academic_structure.sql
-- Requires: course_enrollments, course_lecturers, profiles tables
-- =============================================================================

-- =============================================================================
-- SECTION 1: TABLES
-- =============================================================================

-- 1.1 Course Materials
create table if not exists public.course_materials (
  id                 uuid primary key default uuid_generate_v4(),
  course_id          uuid not null references public.courses(id) on delete cascade,
  uploaded_by        uuid not null references public.profiles(id) on delete restrict,
  title              text not null,
  description        text,
  material_type      text not null default 'LECTURE_NOTE'
                       check (material_type in (
                         'LECTURE_NOTE','PRESENTATION','HANDOUT','ASSIGNMENT',
                         'LABORATORY_MANUAL','TUTORIAL','READING_MATERIAL',
                         'REFERENCE_MATERIAL','EXAM_PREPARATION','OTHER'
                       )),
  file_name          text,
  storage_path       text,         -- path inside 'course-materials' bucket
  file_size          bigint,       -- bytes
  file_type          text,         -- MIME type
  module_chapter     text,         -- e.g. "Chapter 3"
  publication_status text not null default 'DRAFT'
                       check (publication_status in ('DRAFT','PUBLISHED','ARCHIVED')),
  visibility         text not null default 'COURSE'
                       check (visibility in ('PRIVATE','COURSE','DEPARTMENT','UNIVERSITY','PUBLIC')),
  version            int  not null default 1,
  download_count     int  not null default 0,
  view_count         int  not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.course_materials is
  'Digital course materials uploaded by lecturers. Access enforced by enrollment and assignment relationships.';

-- 1.2 Material Versions (audit trail of file replacements)
create table if not exists public.material_versions (
  id            uuid primary key default uuid_generate_v4(),
  material_id   uuid not null references public.course_materials(id) on delete cascade,
  version       int  not null,
  file_name     text,
  storage_path  text,
  file_size     bigint,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table public.material_versions is 'Version history for course material files.';

-- =============================================================================
-- SECTION 2: INDEXES
-- =============================================================================

create index if not exists idx_course_materials_course_id    on public.course_materials(course_id);
create index if not exists idx_course_materials_uploaded_by  on public.course_materials(uploaded_by);
create index if not exists idx_course_materials_status       on public.course_materials(publication_status);
create index if not exists idx_course_materials_visibility   on public.course_materials(visibility);
create index if not exists idx_material_versions_material_id on public.material_versions(material_id);

-- Full-text search index on title + description
create index if not exists idx_course_materials_fts on public.course_materials
  using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

-- =============================================================================
-- SECTION 3: UPDATED_AT TRIGGER
-- =============================================================================

drop trigger if exists course_materials_updated_at on public.course_materials;
create trigger course_materials_updated_at
  before update on public.course_materials
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- SECTION 4: HELPER FUNCTIONS
-- =============================================================================

-- Is the current user enrolled in a course (active)?
create or replace function public.is_enrolled_in_course(p_course_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.course_enrollments
    where course_id  = p_course_id
      and student_id = auth.uid()
      and status     = 'ACTIVE'
  );
$$;

-- Is the current user assigned as lecturer for a course?
create or replace function public.is_assigned_to_course(p_course_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.course_lecturers
    where course_id   = p_course_id
      and lecturer_id = auth.uid()
  );
$$;

-- Can the current user access a material?
-- Rules:
--   PUBLIC     -> anyone
--   COURSE     -> enrolled student OR assigned lecturer OR admin
--   DEPARTMENT -> user belongs to same department OR admin
--   UNIVERSITY -> any authenticated user
--   PRIVATE    -> uploader OR admin
create or replace function public.can_access_material(p_material_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare
  v_visibility         text;
  v_course_id          uuid;
  v_uploaded_by        uuid;
  v_publication_status text;
  v_role               text;
begin
  select visibility, course_id, uploaded_by, publication_status
  into   v_visibility, v_course_id, v_uploaded_by, v_publication_status
  from   public.course_materials
  where  id = p_material_id;

  if not found then return false; end if;

  -- Only PUBLISHED materials are accessible (except to the uploader/admin)
  v_role := public.get_user_role(auth.uid());

  if v_publication_status != 'PUBLISHED' then
    -- Draft/archived: only uploader or admin can see
    return v_uploaded_by = auth.uid() or v_role = 'ACADEMIC_LIBRARY_ADMIN';
  end if;

  case v_visibility
    when 'PUBLIC' then
      return true;
    when 'UNIVERSITY' then
      return auth.uid() is not null;
    when 'COURSE' then
      return (
        public.is_enrolled_in_course(v_course_id)
        or public.is_assigned_to_course(v_course_id)
        or v_role = 'ACADEMIC_LIBRARY_ADMIN'
      );
    when 'DEPARTMENT' then
      return (
        exists (
          select 1 from public.profiles p
          join public.courses c on c.department_id = p.department_id
          where p.id = auth.uid() and c.id = v_course_id
        )
        or v_role = 'ACADEMIC_LIBRARY_ADMIN'
      );
    when 'PRIVATE' then
      return v_uploaded_by = auth.uid() or v_role = 'ACADEMIC_LIBRARY_ADMIN';
    else
      return false;
  end case;
end;
$$;

grant execute on function public.is_enrolled_in_course(uuid)  to authenticated;
grant execute on function public.is_assigned_to_course(uuid)  to authenticated;
grant execute on function public.can_access_material(uuid)    to authenticated;

-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- =============================================================================

alter table public.course_materials  enable row level security;
alter table public.material_versions enable row level security;

-- ── course_materials ──────────────────────────────────────────────────────────

-- SELECT: use can_access_material() — covers all visibility rules
create policy "course_materials: access check"
  on public.course_materials for select
  using (public.can_access_material(id));

-- INSERT: lecturer must be assigned to the course
create policy "course_materials: lecturer insert"
  on public.course_materials for insert
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_assigned_to_course(course_id)
      or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
    )
  );

-- UPDATE: uploader can edit own materials; admin can edit any
create policy "course_materials: own update"
  on public.course_materials for update
  using (
    uploaded_by = auth.uid()
    or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );

-- DELETE: uploader can delete own; admin can delete any
create policy "course_materials: own delete"
  on public.course_materials for delete
  using (
    uploaded_by = auth.uid()
    or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );

-- ── material_versions ─────────────────────────────────────────────────────────

create policy "material_versions: access via material"
  on public.material_versions for select
  using (public.can_access_material(material_id));

create policy "material_versions: uploader insert"
  on public.material_versions for insert
  with check (uploaded_by = auth.uid());

-- =============================================================================
-- SECTION 6: STORAGE POLICIES (run separately if needed)
-- =============================================================================
-- The 'course-materials' bucket must be PRIVATE.
-- Files are served only via signed URLs generated server-side.
--
-- Bucket-level RLS equivalent (Supabase Storage policies):
--
-- UPLOAD policy (INSERT):
--   bucket_id = 'course-materials'
--   auth.uid() is not null
--   AND get_user_role(auth.uid()) IN ('LECTURER','ACADEMIC_LIBRARY_ADMIN')
--
-- DOWNLOAD policy (SELECT) — enforced in application via can_access_material():
--   Signed URLs are generated only after can_access_material() returns true.
--   The storage path includes the material ID for verification.
--
-- Storage path convention:
--   course-materials/{course_id}/{material_id}/{filename}
-- =============================================================================

-- =============================================================================
-- DONE
-- =============================================================================
