-- =============================================================================
-- DMU Academic Hub — Migration 024: Notify Admins on New Research Submissions
-- =============================================================================
-- Root Cause:
-- The trigger function `notify_research_review()` only ran on UPDATE of
-- `approval_status` (notifying the submitter when approved or rejected).
-- There was no trigger or logic creating a notification for administrators
-- (ACADEMIC_LIBRARY_ADMIN) when new research papers were submitted for review.
--
-- Fix:
-- 1. Update `notify_research_review()` to handle both INSERT and UPDATE:
--    - On INSERT (with approval_status = 'PENDING'):
--      Creates a notification for all users with ACADEMIC_LIBRARY_ADMIN role.
--    - On UPDATE (approval_status changes to 'PENDING'):
--      Creates a re-submission notification for all admins.
--    - On UPDATE (approval_status changes to 'APPROVED' or 'REJECTED'):
--      Creates a review update notification for the submitter.
-- 2. Update the trigger on `public.research_resources` to fire AFTER INSERT
--    or UPDATE of approval_status, title.
-- 3. Backfill notifications for any existing PENDING research that admins have
--    not yet been notified about.
-- =============================================================================

create or replace function public.notify_research_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_message text;
  v_submitter_name text;
begin
  -- 1. New research submitted (INSERT) or re-submitted (UPDATE back to PENDING) -> Notify Admins
  if (tg_op = 'INSERT' and coalesce(new.approval_status, 'PENDING') = 'PENDING')
     or (tg_op = 'UPDATE' and new.approval_status = 'PENDING' and old.approval_status is distinct from 'PENDING') then

    -- Fetch submitter's full name if available
    select full_name into v_submitter_name
    from public.profiles
    where id = new.submitted_by;

    insert into public.notifications (user_id, title, message, type, resource_type, resource_id)
    select
      ur.user_id,
      case when tg_op = 'INSERT' then 'New research submission' else 'Research re-submitted' end,
      case
        when v_submitter_name is not null and trim(v_submitter_name) <> '' then
          format('"%s" was submitted for review by %s.', new.title, v_submitter_name)
        else
          format('"%s" was submitted for review.', new.title)
      end,
      'RESEARCH_SUBMITTED',
      'research',
      new.id
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.name = 'ACADEMIC_LIBRARY_ADMIN';

    return new;
  end if;

  -- 2. Status update to APPROVED or REJECTED -> Notify Submitter
  if tg_op = 'UPDATE' and old.approval_status is distinct from new.approval_status then
    if new.approval_status = 'APPROVED' then
      v_type := 'RESEARCH_APPROVED';
      v_message := format('Your research submission "%s" has been approved.', new.title);
    elsif new.approval_status = 'REJECTED' then
      v_type := 'RESEARCH_REJECTED';
      v_message := format('Your research submission "%s" was not approved. %s',
        new.title, coalesce(new.rejection_reason, 'Please contact the administrator for details.'));
    else
      return new;
    end if;

    insert into public.notifications (user_id, title, message, type, resource_type, resource_id)
    values (
      new.submitted_by,
      case when v_type = 'RESEARCH_APPROVED' then 'Research approved' else 'Research review update' end,
      v_message,
      v_type,
      'research',
      new.id
    );

    return new;
  end if;

  return new;
end;
$$;

-- Recreate trigger to fire on INSERT as well
drop trigger if exists research_review_notification on public.research_resources;
create trigger research_review_notification
  after insert or update of approval_status, title
  on public.research_resources
  for each row execute function public.notify_research_review();

-- Backfill: notify admins for existing active PENDING research if not already notified
insert into public.notifications (user_id, title, message, type, resource_type, resource_id)
select
  ur.user_id,
  'Pending research submission',
  format('"%s" is awaiting administrative review.', r.title),
  'RESEARCH_SUBMITTED',
  'research',
  r.id
from public.research_resources r
cross join (
  select user_roles.user_id
  from public.user_roles
  join public.roles on roles.id = user_roles.role_id
  where roles.name = 'ACADEMIC_LIBRARY_ADMIN'
) ur
where r.approval_status = 'PENDING'
  and r.is_active = true
  and not exists (
    select 1
    from public.notifications n
    where n.user_id = ur.user_id
      and n.resource_id = r.id
      and n.type = 'RESEARCH_SUBMITTED'
  );
