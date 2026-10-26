-- =============================================================================
-- DMU Academic Hub — Migration 005: Research Repository
-- =============================================================================
-- Run this AFTER 002_academic_structure.sql
-- =============================================================================

-- =============================================================================
-- SECTION 1: TABLES
-- =============================================================================

-- 1.1 Research Resources (theses, papers, projects, dissertations)
create table if not exists public.research_resources (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  abstract         text,
  resource_type    text not null default 'RESEARCH_PAPER'
                     check (resource_type in (
                       'THESIS','GRADUATION_PROJECT','RESEARCH_PAPER',
                       'DISSERTATION','SEMINAR','TECHNICAL_REPORT'
                     )),
  department_id    uuid references public.departments(id) on delete set null,
  program_id       uuid references public.programs(id) on delete set null,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  supervisor       text,                  -- supervisor name (free text)
  publication_date date,
  file_name        text,
  storage_path     text,                  -- path in 'research-resources' bucket
  file_size        bigint,
  visibility       text not null default 'DMU_ONLY'
                     check (visibility in ('PRIVATE','DMU_ONLY','DEPARTMENT','PUBLIC')),
  approval_status  text not null default 'PENDING'
                     check (approval_status in ('PENDING','APPROVED','REJECTED')),
  approved_by      uuid references public.profiles(id) on delete set null,
  approved_at      timestamptz,
  rejection_reason text,
  submitted_by     uuid not null references public.profiles(id) on delete restrict,
  view_count       int not null default 0,
  download_count   int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.research_resources is
  'Research repository: theses, graduation projects, papers, dissertations. Access controlled by visibility and approval status.';

-- 1.2 Research Authors (supports multi-author)
create table if not exists public.research_authors (
  id          uuid primary key default uuid_generate_v4(),
  resource_id uuid not null references public.research_resources(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  author_name text not null,  -- stored name (in case profile is deleted)
  author_order int not null default 1,
  created_at  timestamptz not null default now()
);

-- 1.3 Research Keywords
create table if not exists public.research_keywords (
  id          uuid primary key default uuid_generate_v4(),
  resource_id uuid not null references public.research_resources(id) on delete cascade,
  keyword     text not null,
  created_at  timestamptz not null default now(),
  unique(resource_id, keyword)
);

-- =============================================================================
-- SECTION 2: INDEXES
-- =============================================================================

create index if not exists idx_research_resources_dept      on public.research_resources(department_id);
create index if not exists idx_research_resources_type      on public.research_resources(resource_type);
create index if not exists idx_research_resources_status    on public.research_resources(approval_status);
create index if not exists idx_research_resources_visibility on public.research_resources(visibility);
create index if not exists idx_research_resources_submitted on public.research_resources(submitted_by);
create index if not exists idx_research_authors_resource    on public.research_authors(resource_id);
create index if not exists idx_research_keywords_resource   on public.research_keywords(resource_id);

-- Full-text search
create index if not exists idx_research_fts on public.research_resources
  using gin(to_tsvector('english',
    coalesce(title,'') || ' ' ||
    coalesce(abstract,'') || ' ' ||
    coalesce(supervisor,'')
  ));

-- =============================================================================
-- SECTION 3: UPDATED_AT TRIGGER
-- =============================================================================

drop trigger if exists research_resources_updated_at on public.research_resources;
create trigger research_resources_updated_at
  before update on public.research_resources
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- SECTION 4: HELPER FUNCTION
-- =============================================================================

-- Can the current user access this research resource?
create or replace function public.can_access_research(p_resource_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare
  v_visibility     text;
  v_approval       text;
  v_submitted_by   uuid;
  v_department_id  uuid;
  v_role           text;
begin
  select visibility, approval_status, submitted_by, department_id
  into   v_visibility, v_approval, v_submitted_by, v_department_id
  from   public.research_resources
  where  id = p_resource_id and is_active = true;

  if not found then return false; end if;

  v_role := public.get_user_role(auth.uid());

  -- Admin can always see everything
  if v_role = 'ACADEMIC_LIBRARY_ADMIN' then return true; end if;

  -- Submitter can always see their own
  if v_submitted_by = auth.uid() then return true; end if;

  -- Only APPROVED resources are visible to others
  if v_approval != 'APPROVED' then return false; end if;

  case v_visibility
    when 'PUBLIC' then
      return true;
    when 'DMU_ONLY' then
      return auth.uid() is not null;
    when 'DEPARTMENT' then
      return exists (
        select 1 from public.profiles
        where id = auth.uid()
          and department_id = v_department_id
      );
    when 'PRIVATE' then
      return v_submitted_by = auth.uid();
    else
      return false;
  end case;
end;
$$;

grant execute on function public.can_access_research(uuid) to authenticated;
grant execute on function public.can_access_research(uuid) to anon;

-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- =============================================================================

alter table public.research_resources enable row level security;
alter table public.research_authors    enable row level security;
alter table public.research_keywords   enable row level security;

-- ── research_resources ────────────────────────────────────────────────────────
create policy "research: access check"
  on public.research_resources for select
  using (public.can_access_research(id));

create policy "research: authenticated submit"
  on public.research_resources for insert
  with check (
    auth.uid() is not null
    and submitted_by = auth.uid()
  );

create policy "research: own update"
  on public.research_resources for update
  using (
    submitted_by = auth.uid()
    or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );

create policy "research: admin delete"
  on public.research_resources for delete
  using (public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN');

-- ── research_authors ──────────────────────────────────────────────────────────
create policy "research_authors: access via resource"
  on public.research_authors for select
  using (public.can_access_research(resource_id));

create policy "research_authors: submitter insert"
  on public.research_authors for insert
  with check (
    exists (
      select 1 from public.research_resources r
      where r.id = resource_id and r.submitted_by = auth.uid()
    )
    or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );

create policy "research_authors: submitter delete"
  on public.research_authors for delete
  using (
    exists (
      select 1 from public.research_resources r
      where r.id = resource_id and r.submitted_by = auth.uid()
    )
    or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );

-- ── research_keywords ─────────────────────────────────────────────────────────
create policy "research_keywords: access via resource"
  on public.research_keywords for select
  using (public.can_access_research(resource_id));

create policy "research_keywords: submitter write"
  on public.research_keywords for all
  using (
    exists (
      select 1 from public.research_resources r
      where r.id = resource_id and r.submitted_by = auth.uid()
    )
    or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  )
  with check (
    exists (
      select 1 from public.research_resources r
      where r.id = resource_id and r.submitted_by = auth.uid()
    )
    or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );

-- =============================================================================
-- DONE
-- Storage: 'research-resources' bucket must be PRIVATE.
-- Files served via signed URLs only after can_access_research() = true.
-- Storage path: research-resources/{resource_id}/{filename}
-- =============================================================================
