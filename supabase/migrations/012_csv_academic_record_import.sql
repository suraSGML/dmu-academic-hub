-- Allow the platform administrator to load university-provided reference data
-- through a single validated, transactional CSV import endpoint.

create or replace function public.import_academic_records(
  p_courses jsonb,
  p_enrollments jsonb,
  p_assignments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_code text;
  v_name text;
  v_college_code text;
  v_department_code text;
  v_academic_year text;
  v_semester_number integer;
  v_department_id uuid;
  v_college_id uuid;
  v_academic_year_id uuid;
  v_semester_id uuid;
  v_course_id uuid;
  v_person_id uuid;
  v_email text;
  v_status text;
  v_action text;
  v_courses_count integer := 0;
  v_enrollments_count integer := 0;
  v_assignments_count integer := 0;
  v_unassignments_count integer := 0;
  v_credit_hours integer;
  v_year_level integer;
  v_is_primary boolean;
begin
  if not public.is_admin() then
    raise exception 'Only platform administrators may import academic records.';
  end if;

  if p_courses is null or p_enrollments is null or p_assignments is null
    or jsonb_typeof(p_courses) <> 'array'
    or jsonb_typeof(p_enrollments) <> 'array'
    or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Import data must be provided as CSV row arrays.';
  end if;

  if jsonb_array_length(p_courses) > 5000
    or jsonb_array_length(p_enrollments) > 5000
    or jsonb_array_length(p_assignments) > 5000 then
    raise exception 'Each CSV file is limited to 5,000 data rows.';
  end if;

  for v_item in select value from jsonb_array_elements(p_courses)
  loop
    v_code := nullif(btrim(v_item->>'course_code'), '');
    v_name := nullif(btrim(v_item->>'course_name'), '');
    v_college_code := nullif(btrim(v_item->>'college_code'), '');
    v_department_code := nullif(btrim(v_item->>'department_code'), '');
    v_academic_year := nullif(btrim(v_item->>'academic_year'), '');

    if v_code is null or v_name is null or v_college_code is null
      or v_department_code is null or v_academic_year is null then
      raise exception 'Course rows require course_code, course_name, college_code, department_code, and academic_year.';
    end if;
    if nullif(btrim(v_item->>'college_name'), '') is null
      or nullif(btrim(v_item->>'department_name'), '') is null
      or nullif(btrim(v_item->>'academic_year_start'), '') is null
      or nullif(btrim(v_item->>'academic_year_end'), '') is null then
      raise exception 'Course rows must include college_name, department_name, academic_year_start, and academic_year_end.';
    end if;

    insert into public.colleges (name, code)
    values (btrim(v_item->>'college_name'), v_college_code)
    on conflict (code) do update
      set name = excluded.name
    returning id into v_college_id;

    insert into public.departments (college_id, name, code)
    values (v_college_id, btrim(v_item->>'department_name'), v_department_code)
    on conflict (code) do update
      set college_id = excluded.college_id, name = excluded.name
    returning id into v_department_id;

    insert into public.academic_years (name, start_date, end_date)
    values (
      v_academic_year,
      (v_item->>'academic_year_start')::date,
      (v_item->>'academic_year_end')::date
    )
    on conflict (name) do update
      set start_date = excluded.start_date, end_date = excluded.end_date
    returning id into v_academic_year_id;

    v_semester_number := (v_item->>'semester_number')::integer;
    if v_semester_number not in (1, 2) then
      raise exception 'semester_number must be 1 or 2.';
    end if;

    insert into public.semesters (
      academic_year_id, name, semester_number, start_date, end_date
    )
    values (
      v_academic_year_id,
      coalesce(nullif(btrim(v_item->>'semester_name'), ''), 'Semester ' || v_semester_number),
      v_semester_number,
      nullif(btrim(v_item->>'semester_start'), '')::date,
      nullif(btrim(v_item->>'semester_end'), '')::date
    )
    on conflict (academic_year_id, semester_number) do update
      set name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date
    returning id into v_semester_id;

    v_credit_hours := coalesce(nullif(btrim(v_item->>'credit_hours'), '')::integer, 3);
    v_year_level := coalesce(nullif(btrim(v_item->>'year_level'), '')::integer, 1);

    insert into public.courses (
      department_id, academic_year_id, semester_id, name, code,
      credit_hours, year_level, description
    )
    values (
      v_department_id, v_academic_year_id, v_semester_id, v_name, v_code,
      v_credit_hours, v_year_level, nullif(btrim(v_item->>'description'), '')
    )
    on conflict (code, academic_year_id, semester_id) do update
      set department_id = excluded.department_id,
          name = excluded.name,
          credit_hours = excluded.credit_hours,
          year_level = excluded.year_level,
          description = excluded.description;

    v_courses_count := v_courses_count + 1;
  end loop;

  for v_item in select value from jsonb_array_elements(p_enrollments)
  loop
    v_code := nullif(btrim(v_item->>'course_code'), '');
    v_academic_year := nullif(btrim(v_item->>'academic_year'), '');
    v_email := lower(nullif(btrim(v_item->>'student_email'), ''));
    v_semester_number := (v_item->>'semester_number')::integer;

    if v_code is null or v_academic_year is null or v_email is null then
      raise exception 'Enrollment rows require course_code, academic_year, semester_number, and student_email.';
    end if;
    if v_semester_number not in (1, 2) then
      raise exception 'semester_number must be 1 or 2.';
    end if;

    select c.id into v_course_id
    from public.courses c
    join public.academic_years ay on ay.id = c.academic_year_id
    join public.semesters s on s.id = c.semester_id
    where c.code = v_code and ay.name = v_academic_year
      and s.semester_number = v_semester_number;
    if v_course_id is null then
      raise exception 'Course % / % semester % was not found.', v_code, v_academic_year, v_semester_number;
    end if;

    select p.id into v_person_id
    from public.profiles p
    where lower(p.email) = v_email;
    if v_person_id is null or public.get_user_role(v_person_id) <> 'STUDENT'
      or not exists (select 1 from public.profiles where id = v_person_id and is_active) then
      raise exception 'Student account % was not found or does not have the STUDENT role.', v_email;
    end if;

    v_status := upper(coalesce(nullif(btrim(v_item->>'status'), ''), 'ACTIVE'));
    if v_status not in ('ACTIVE', 'DROPPED', 'COMPLETED') then
      raise exception 'Enrollment status must be ACTIVE, DROPPED, or COMPLETED.';
    end if;

    insert into public.course_enrollments (course_id, student_id, enrolled_by, status)
    values (v_course_id, v_person_id, auth.uid(), v_status)
    on conflict (course_id, student_id) do update
      set enrolled_by = auth.uid(), status = excluded.status;

    v_enrollments_count := v_enrollments_count + 1;
  end loop;

  for v_item in select value from jsonb_array_elements(p_assignments)
  loop
    v_code := nullif(btrim(v_item->>'course_code'), '');
    v_academic_year := nullif(btrim(v_item->>'academic_year'), '');
    v_email := lower(nullif(btrim(v_item->>'lecturer_email'), ''));
    v_semester_number := (v_item->>'semester_number')::integer;
    v_action := upper(coalesce(nullif(btrim(v_item->>'action'), ''), 'ASSIGN'));

    if v_code is null or v_academic_year is null or v_email is null then
      raise exception 'Assignment rows require course_code, academic_year, semester_number, and lecturer_email.';
    end if;
    if v_semester_number not in (1, 2) then
      raise exception 'semester_number must be 1 or 2.';
    end if;
    if v_action not in ('ASSIGN', 'UNASSIGN') then
      raise exception 'Assignment action must be ASSIGN or UNASSIGN.';
    end if;

    select c.id into v_course_id
    from public.courses c
    join public.academic_years ay on ay.id = c.academic_year_id
    join public.semesters s on s.id = c.semester_id
    where c.code = v_code and ay.name = v_academic_year
      and s.semester_number = v_semester_number;
    if v_course_id is null then
      raise exception 'Course % / % semester % was not found.', v_code, v_academic_year, v_semester_number;
    end if;

    select p.id into v_person_id
    from public.profiles p
    where lower(p.email) = v_email;
    if v_person_id is null or public.get_user_role(v_person_id) <> 'LECTURER'
      or not exists (select 1 from public.profiles where id = v_person_id and is_active) then
      raise exception 'Lecturer account % was not found or does not have the LECTURER role.', v_email;
    end if;

    if v_action = 'UNASSIGN' then
      delete from public.course_lecturers
      where course_id = v_course_id and lecturer_id = v_person_id;
      v_unassignments_count := v_unassignments_count + 1;
    else
      if lower(coalesce(nullif(btrim(v_item->>'is_primary'), ''), 'true'))
        not in ('true', 'false', '1', '0', 'yes', 'no') then
        raise exception 'is_primary must be true or false.';
      end if;
      v_is_primary := lower(coalesce(nullif(btrim(v_item->>'is_primary'), ''), 'true')) in ('true', '1', 'yes');
      insert into public.course_lecturers (course_id, lecturer_id, is_primary, assigned_by)
      values (v_course_id, v_person_id, v_is_primary, auth.uid())
      on conflict (course_id, lecturer_id) do update
        set is_primary = excluded.is_primary, assigned_by = auth.uid();
      v_assignments_count := v_assignments_count + 1;
    end if;
  end loop;

  insert into public.audit_logs (user_id, action, resource_type, metadata)
  values (
    auth.uid(),
    'ACADEMIC_CSV_IMPORT',
    'academic_records',
    jsonb_build_object(
      'courses', v_courses_count,
      'enrollments', v_enrollments_count,
      'assignments', v_assignments_count,
      'unassignments', v_unassignments_count
    )
  );

  return jsonb_build_object(
    'courses', v_courses_count,
    'enrollments', v_enrollments_count,
    'assignments', v_assignments_count,
    'unassignments', v_unassignments_count
  );
end;
$$;

revoke all on function public.import_academic_records(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_academic_records(jsonb, jsonb, jsonb) to authenticated;
