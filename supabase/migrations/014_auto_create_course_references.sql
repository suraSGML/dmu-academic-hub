-- Let the admin course CSV create missing college, department, academic-year,
-- and semester reference rows from names rather than requiring database setup.

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
  v_normalized_courses jsonb := '[]'::jsonb;
  v_college_name text;
  v_department_name text;
  v_academic_year text;
  v_semester_number integer;
  v_first_year integer;
  v_last_year integer;
  v_college_id uuid;
  v_department_id uuid;
  v_college_code text;
  v_department_code text;
  v_code_base text;
  v_suffix integer;
  v_academic_year_id uuid;
  v_semester_id uuid;
  v_year_start date;
  v_year_end date;
  v_semester_name text;
  v_semester_start date;
  v_semester_end date;
  v_reference record;
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
    v_college_name := nullif(btrim(v_item->>'college_name'), '');
    v_department_name := nullif(btrim(v_item->>'department_name'), '');
    v_academic_year := nullif(btrim(v_item->>'academic_year'), '');

    if nullif(btrim(v_item->>'course_code'), '') is null
      or nullif(btrim(v_item->>'course_name'), '') is null
      or v_college_name is null
      or v_department_name is null
      or v_academic_year is null
      or nullif(btrim(v_item->>'semester_number'), '') is null then
      raise exception 'Course rows require course_code, course_name, college_name, department_name, academic_year, and semester_number.';
    end if;

    begin
      v_semester_number := (v_item->>'semester_number')::integer;
    exception when invalid_text_representation then
      raise exception 'semester_number must be 1 or 2.';
    end;
    if v_semester_number not in (1, 2) then
      raise exception 'semester_number must be 1 or 2.';
    end if;

    select id into v_college_id
    from public.colleges
    where lower(name) = lower(v_college_name)
    limit 1;

    if v_college_id is null then
      v_code_base := left(
        trim(both '-' from regexp_replace(upper(v_college_name), '[^A-Z0-9]+', '-', 'g')),
        40
      );
      if v_code_base = '' then
        v_code_base := 'COLLEGE';
      end if;
      v_college_code := v_code_base;
      v_suffix := 1;
      while exists (select 1 from public.colleges where code = v_college_code) loop
        v_college_code := left(v_code_base, 32) || '-' || v_suffix;
        v_suffix := v_suffix + 1;
      end loop;

      insert into public.colleges (name, code)
      values (v_college_name, v_college_code)
      returning id into v_college_id;
    else
      update public.colleges set is_active = true where id = v_college_id;
    end if;

    select id into v_department_id
    from public.departments
    where college_id = v_college_id
      and lower(name) = lower(v_department_name)
    limit 1;

    if v_department_id is null then
      v_code_base := left(
        trim(both '-' from regexp_replace(
          upper(v_college_name || '-' || v_department_name),
          '[^A-Z0-9]+',
          '-',
          'g'
        )),
        40
      );
      if v_code_base = '' then
        v_code_base := 'DEPARTMENT';
      end if;
      v_department_code := v_code_base;
      v_suffix := 1;
      while exists (select 1 from public.departments where code = v_department_code) loop
        v_department_code := left(v_code_base, 32) || '-' || v_suffix;
        v_suffix := v_suffix + 1;
      end loop;

      insert into public.departments (college_id, name, code)
      values (v_college_id, v_department_name, v_department_code)
      returning id into v_department_id;
    else
      update public.departments set is_active = true where id = v_department_id;
    end if;

    select id, start_date, end_date
    into v_academic_year_id, v_year_start, v_year_end
    from public.academic_years
    where lower(name) = lower(v_academic_year)
    limit 1;

    if v_academic_year_id is null then
      if v_academic_year !~ '^[0-9]{4}/[0-9]{4}$'
        or split_part(v_academic_year, '/', 2)::integer
          <> split_part(v_academic_year, '/', 1)::integer + 1 then
        raise exception 'Academic year % is not in the expected YYYY/YYYY format (for example, 2025/2026).',
          v_academic_year;
      end if;
      v_first_year := split_part(v_academic_year, '/', 1)::integer;
      v_last_year := split_part(v_academic_year, '/', 2)::integer;

      insert into public.academic_years (name, start_date, end_date)
      values (
        v_academic_year,
        make_date(v_first_year, 9, 1),
        make_date(v_last_year, 6, 30)
      )
      returning id, start_date, end_date
        into v_academic_year_id, v_year_start, v_year_end;
    end if;

    select id, name, start_date, end_date
    into v_semester_id, v_semester_name, v_semester_start, v_semester_end
    from public.semesters
    where academic_year_id = v_academic_year_id
      and semester_number = v_semester_number
    limit 1;

    if v_semester_id is null then
      insert into public.semesters (academic_year_id, name, semester_number)
      values (
        v_academic_year_id,
        case v_semester_number when 1 then 'Semester I' else 'Semester II' end,
        v_semester_number
      )
      returning id, name, start_date, end_date
        into v_semester_id, v_semester_name, v_semester_start, v_semester_end;
    end if;

    select
      c.code as college_code,
      c.name as college_name,
      d.code as department_code,
      d.name as department_name,
      v_year_start as academic_year_start,
      v_year_end as academic_year_end,
      v_semester_name as semester_name,
      v_semester_start as semester_start,
      v_semester_end as semester_end
    into v_reference
    from public.departments d
    join public.colleges c on c.id = d.college_id
    where d.id = v_department_id;

    v_normalized_courses := v_normalized_courses || jsonb_build_array(
      v_item || jsonb_build_object(
        'college_code', v_reference.college_code,
        'college_name', v_reference.college_name,
        'department_code', v_reference.department_code,
        'department_name', v_reference.department_name,
        'academic_year_start', v_reference.academic_year_start,
        'academic_year_end', v_reference.academic_year_end,
        'semester_name', v_reference.semester_name,
        'semester_start', v_reference.semester_start,
        'semester_end', v_reference.semester_end
      )
    );
  end loop;

  return public.import_academic_records_full(
    v_normalized_courses,
    p_enrollments,
    p_assignments
  );
end;
$$;

revoke all on function public.import_academic_records(jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.import_academic_records(jsonb, jsonb, jsonb)
  to authenticated;
