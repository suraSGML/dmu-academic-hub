-- Migration 026: Allow submitters (lecturers) and admins to delete research resources
-- Cascade will delete research_authors and research_keywords automatically.

drop policy if exists "research: admin delete" on public.research_resources;
drop policy if exists "research: submitter or admin delete" on public.research_resources;

create policy "research: submitter or admin delete"
  on public.research_resources for delete
  using (
    submitted_by = auth.uid()
    or public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );
