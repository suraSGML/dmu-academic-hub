-- =============================================================================
-- DMU Academic Hub — Migration 025: Restrict Research Submission to Lecturers & Admins
-- =============================================================================
-- Requirement:
-- Only lecturers (and academic library administrators) are authorized to submit/publish research.
-- Students are readers only and cannot submit research papers.
--
-- Fix:
-- Update the INSERT policy on `public.research_resources` to require that the uploader
-- has the LECTURER or ACADEMIC_LIBRARY_ADMIN role in user_roles.
-- =============================================================================

drop policy if exists "research: authenticated submit" on public.research_resources;
drop policy if exists "research: lecturer submit" on public.research_resources;

create policy "research: lecturer submit"
  on public.research_resources for insert
  to authenticated
  with check (
    auth.uid() is not null
    and submitted_by = auth.uid()
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name in ('LECTURER', 'ACADEMIC_LIBRARY_ADMIN')
    )
  );

-- Also ensure storage upload to research-resources bucket is restricted to lecturers & admins
drop policy if exists "research-resources: authenticated upload" on storage.objects;
drop policy if exists "research-resources: lecturer upload" on storage.objects;

create policy "research-resources: lecturer upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'research-resources'
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name in ('LECTURER', 'ACADEMIC_LIBRARY_ADMIN')
    )
  );
