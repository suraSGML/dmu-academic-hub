-- Allow administrators to set a student's university ID without granting
-- broad UPDATE access to other profile fields.

create or replace function public.set_student_id(
  p_profile_id uuid,
  p_student_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id text := nullif(btrim(p_student_id), '');
begin
  if not public.is_admin() then
    raise exception 'Only platform administrators may set student IDs.';
  end if;

  if p_profile_id is null or v_student_id is null then
    raise exception 'A student profile and student ID are required.';
  end if;
  if length(v_student_id) > 50 then
    raise exception 'Student ID must be 50 characters or fewer.';
  end if;
  if public.get_user_role(p_profile_id) <> 'STUDENT' then
    raise exception 'Student IDs can only be set for accounts with the STUDENT role.';
  end if;

  update public.profiles
  set student_id = v_student_id,
      updated_at = now()
  where id = p_profile_id;

  if not found then
    raise exception 'Student profile was not found.';
  end if;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(),
    'STUDENT_ID_UPDATED',
    'user',
    p_profile_id,
    jsonb_build_object('student_id', v_student_id)
  );

  return v_student_id;
exception
  when unique_violation then
    raise exception 'Student ID % is already assigned to another account.', v_student_id;
end;
$$;

revoke all on function public.set_student_id(uuid, text) from public, anon;
grant execute on function public.set_student_id(uuid, text) to authenticated;
