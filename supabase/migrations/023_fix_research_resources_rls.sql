-- =============================================================================
-- DMU Academic Hub — Migration 023: Fix Research Resources RLS Policies
-- =============================================================================
-- Solves 403 (Forbidden) on POST /rest/v1/research_resources?select=*:
--
-- Root Cause:
-- 1. Inserting with .select("*") forces PostgREST to execute INSERT ... RETURNING *.
-- 2. PostgreSQL evaluates the table's SELECT RLS policy on the returned row.
-- 3. The original SELECT policy ("research: access check") called can_access_research(id),
--    which executed `SELECT ... FROM public.research_resources WHERE id = p_resource_id`.
--    During the INSERT statement, the uncommitted in-flight row is NOT visible in the
--    MVCC snapshot of an internal function query, returning FALSE -> Postgres error 42501 (403).
-- 4. In addition, using get_user_role() inside RLS can trigger recursion or return NULL.
-- =============================================================================

-- 1. Direct-column SELECT policy on research_resources
drop policy if exists "research: access check" on public.research_resources;
create policy "research: access check"
  on public.research_resources for select
  using (
    -- Submitter can always view their own resources (including PENDING status and during INSERT RETURNING)
    (auth.uid() is not null and submitted_by = auth.uid())
    -- Admins can view all resources
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'ACADEMIC_LIBRARY_ADMIN'
    )
    -- Other users can view active, approved resources according to visibility
    or (
      approval_status = 'APPROVED'
      and is_active = true
      and (
        visibility = 'PUBLIC'
        or (visibility = 'DMU_ONLY' and auth.uid() is not null)
        or (
          visibility = 'DEPARTMENT' and exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.department_id = research_resources.department_id
          )
        )
      )
    )
  );

-- 2. INSERT policy for authenticated users
drop policy if exists "research: authenticated submit" on public.research_resources;
create policy "research: authenticated submit"
  on public.research_resources for insert
  to authenticated
  with check (
    auth.uid() is not null
    and submitted_by = auth.uid()
  );

-- 3. Authors and Keywords insert policies (direct role check, avoiding get_user_role recursion)
drop policy if exists "research_authors: submitter insert" on public.research_authors;
create policy "research_authors: submitter insert"
  on public.research_authors for insert
  to authenticated
  with check (
    exists (
      select 1 from public.research_resources r
      where r.id = resource_id and r.submitted_by = auth.uid()
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'ACADEMIC_LIBRARY_ADMIN'
    )
  );

drop policy if exists "research_keywords: submitter write" on public.research_keywords;
create policy "research_keywords: submitter write"
  on public.research_keywords for insert
  to authenticated
  with check (
    exists (
      select 1 from public.research_resources r
      where r.id = resource_id and r.submitted_by = auth.uid()
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'ACADEMIC_LIBRARY_ADMIN'
    )
  );
