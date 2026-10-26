-- Fix the year lookup in migration 014. A SELECT INTO with no match clears
-- target variables, so the input year must not be one of its targets.
-- This compatibility wrapper creates missing year rows before calling the
-- existing importer, which also allows databases that already ran migration
-- 014 to use the corrected import behavior.

alter function public.import_academic_records(jsonb, jsonb, jsonb)
  rename to import_academic_records_auto_create_v1;

revoke all on function public.import_academic_records_auto_create_v1(jsonb, jsonb, jsonb)
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
  v_year_name text;
  v_first_year integer;
  v_last_year integer;
  v_exists boolean;
begin
  if not public.is_admin() then
    raise exception 'Only platform administrators may import academic records.';
  end if;

  if p_courses is null or jsonb_typeof(p_courses) <> 'array'
    or p_enrollments is null or jsonb_typeof(p_enrollments) <> 'array'
    or p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Import data must be provided as CSV row arrays.';
  end if;

  if jsonb_array_length(p_courses) > 5000
    or jsonb_array_length(p_enrollments) > 5000
    or jsonb_array_length(p_assignments) > 5000 then
    raise exception 'Each CSV file is limited to 5,000 data rows.';
  end if;

  for v_item in select value from jsonb_array_elements(p_courses)
  loop
    v_year_name := nullif(btrim(v_item->>'academic_year'), '');
    if v_year_name is null then
      raise exception 'Course rows require academic_year.';
    end if;

    select exists (
      select 1 from public.academic_years
      where lower(name) = lower(v_year_name)
    ) into v_exists;

    if not v_exists then
      if v_year_name !~ '^[0-9]{4}/[0-9]{4}$' then
        raise exception 'Academic year % is not in YYYY/YYYY format (for example, 2025/2026).',
          v_year_name;
      end if;

      v_first_year := split_part(v_year_name, '/', 1)::integer;
      v_last_year := split_part(v_year_name, '/', 2)::integer;
      if v_first_year < 1 or v_first_year >= 9999
        or v_last_year <> v_first_year + 1 then
        raise exception 'Academic year % must contain consecutive years in YYYY/YYYY format.',
          v_year_name;
      end if;

      insert into public.academic_years (name, start_date, end_date)
      values (
        v_year_name,
        make_date(v_first_year, 9, 1),
        make_date(v_last_year, 6, 30)
      )
      on conflict (name) do nothing;
    end if;
  end loop;

  return public.import_academic_records_auto_create_v1(
    p_courses,
    p_enrollments,
    p_assignments
  );
end;
$$;

revoke all on function public.import_academic_records(jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.import_academic_records(jsonb, jsonb, jsonb)
  to authenticated;
