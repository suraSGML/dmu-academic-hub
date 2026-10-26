-- Replace per-user student ID entry with one transactional roster import.
-- The importer matches existing STUDENT accounts by email; it does not create
-- authentication accounts or change user roles.

drop function if exists public.set_student_id(uuid, text);

create or replace function public.import_student_ids(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_email text;
  v_student_id text;
  v_profile_id uuid;
  v_profile_count integer;
  v_updated integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only platform administrators may import student IDs.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Student ID data must be provided as a CSV row array.';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    raise exception 'The student ID CSV has no data rows.';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'The student ID CSV is limited to 5,000 data rows.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as entry(item)
    group by lower(btrim(item->>'student_email'))
    having count(*) > 1
  ) then
    raise exception 'The CSV contains a duplicate student email.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as entry(item)
    group by lower(btrim(item->>'student_id'))
    having count(*) > 1
  ) then
    raise exception 'The CSV contains a duplicate student ID.';
  end if;

  for v_item in select item from jsonb_array_elements(p_rows) as entry(item)
  loop
    v_email := lower(nullif(btrim(v_item->>'student_email'), ''));
    v_student_id := nullif(btrim(v_item->>'student_id'), '');
    if v_email is null or v_student_id is null then
      raise exception 'Every row requires student_email and student_id.';
    end if;
    if length(v_student_id) > 50 then
      raise exception 'Student ID for % must be 50 characters or fewer.', v_email;
    end if;

    select count(*)::integer
    into v_profile_count
    from public.profiles
    where lower(email) = v_email;
    if v_profile_count <> 1 then
      raise exception 'Expected one existing account for %, found %.', v_email, v_profile_count;
    end if;

    select id into v_profile_id
    from public.profiles
    where lower(email) = v_email;

    if public.get_user_role(v_profile_id) is distinct from 'STUDENT' then
      raise exception 'Account % does not have the STUDENT role.', v_email;
    end if;

    if exists (
      select 1
      from public.profiles
      where student_id = v_student_id
        and id <> v_profile_id
    ) then
      raise exception 'Student ID % is already assigned to another account.', v_student_id;
    end if;

    update public.profiles
    set student_id = v_student_id,
        updated_at = now()
    where id = v_profile_id;

    v_updated := v_updated + 1;
  end loop;

  insert into public.audit_logs (user_id, action, resource_type, metadata)
  values (
    auth.uid(),
    'STUDENT_IDS_IMPORTED',
    'student_ids',
    jsonb_build_object('updated', v_updated)
  );

  return jsonb_build_object('updated', v_updated);
exception
  when unique_violation then
    raise exception 'A student ID in this CSV is already assigned to another account.';
end;
$$;

revoke all on function public.import_student_ids(jsonb) from public, anon;
grant execute on function public.import_student_ids(jsonb) to authenticated;
