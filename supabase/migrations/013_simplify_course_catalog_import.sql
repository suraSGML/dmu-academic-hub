-- Let the short course CSV format use existing department, academic-year,
-- and semester references instead of repeating their names and dates.

alter function public.import_academic_records(jsonb, jsonb, jsonb)
  rename to import_academic_records_full;

revoke all on function public.import_academic_records_full(jsonb, jsonb, jsonb)
  from public, anon, authenticated;

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
  v_department_code text;
  v_academic_year text;
  v_semester_number integer;
  v_reference record;
begin
  if not public.is_admin() then
    raise exception 'Only platform administrators may import academic records.';
  end if;

  if p_courses is null or jsonb_typeof(p_courses) <> 'array' then
    raise exception 'Course catalog data must be a CSV row array.';
  end if;

  for v_item in select value from jsonb_array_elements(p_courses)
  loop
    v_department_code := nullif(btrim(v_item->>'department_code'), '');
    v_academic_year := nullif(btrim(v_item->>'academic_year'), '');

    if nullif(btrim(v_item->>'course_code'), '') is null
      or nullif(btrim(v_item->>'course_name'), '') is null
      or v_department_code is null
      or v_academic_year is null
      or nullif(btrim(v_item->>'semester_number'), '') is null then
      raise exception 'Course rows require course_code, course_name, department_code, academic_year, and semester_number.';
    end if;

    begin
      v_semester_number := (v_item->>'semester_number')::integer;
    exception when invalid_text_representation then
      raise exception 'semester_number must be 1 or 2.';
    end;
    if v_semester_number not in (1, 2) then
      raise exception 'semester_number must be 1 or 2.';
    end if;

    select
      d.id as department_id,
      d.name as department_name,
      d.code as department_code,
      c.code as college_code,
      c.name as college_name,
      ay.start_date as academic_year_start,
      ay.end_date as academic_year_end,
      s.name as semester_name,
      s.start_date as semester_start,
      s.end_date as semester_end
    into v_reference
    from public.departments d
    join public.colleges c on c.id = d.college_id
    join public.academic_years ay on ay.name = v_academic_year
    join public.semesters s
      on s.academic_year_id = ay.id
      and s.semester_number = v_semester_number
    where d.code = v_department_code
      and d.is_active
      and c.is_active;

    if not found then
      raise exception 'Department %, academic year %, semester % was not found. Import or activate those reference records before the course catalog.',
        v_department_code, v_academic_year, v_semester_number;
    end if;

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
