-- Check scoped access before validation performs lookups that can reveal a record's state.
create function portal_private.check_academic_writer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  caller public.portal_role := portal_private.current_role();
  instructor uuid;
begin
  if auth.uid() is null or caller = 'admin' then return new; end if;
  if caller = 'faculty' then
    select c.faculty_id into instructor
    from public.enrollments e join public.class_assignments c on c.id = e.class_id
    where e.id = new.enrollment_id
    for share of c;
    if instructor = auth.uid() then return new; end if;
  end if;
  raise sqlstate '42501' using message = 'Row-level security denies this academic write';
end
$$;
revoke execute on function portal_private.check_academic_writer() from public, anon, authenticated;
create trigger check_academic_writer before insert or update on public.grades
  for each row execute function portal_private.check_academic_writer();
create trigger check_academic_writer before insert or update on public.attendance
  for each row execute function portal_private.check_academic_writer();

-- Preserve historical numerical results if an administrator revises catalog options.
create function portal_private.preserve_published_grade() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'grading_scales' then
    if (new.grade,new.passing) is distinct from (old.grade,old.passing) and exists (
      select 1 from public.grades where scale_id = old.id and status = 'published'
    ) then raise exception 'Create a new grading option to preserve published results'; end if;
  elsif new.units is distinct from old.units and exists (
    select 1 from public.enrollments e join public.grades g on g.enrollment_id = e.id
    where e.subject_id = old.id and g.status = 'published'
  ) then raise exception 'Create a new subject code to preserve published credit units'; end if;
  return new;
end
$$;
revoke execute on function portal_private.preserve_published_grade() from public, anon, authenticated;
create trigger preserve_published_option before update on public.grading_scales
  for each row execute function portal_private.preserve_published_grade();
create trigger preserve_published_units before update on public.subjects
  for each row execute function portal_private.preserve_published_grade();
