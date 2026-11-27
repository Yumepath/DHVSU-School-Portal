create schema if not exists portal_private;
revoke all on schema portal_private from public;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

create type public.portal_role as enum ('student','faculty','admin');
create type public.enrollment_status as enum ('enrolled','completed','withdrawn');
create type public.grade_status as enum ('draft','submitted','published');
create type public.attendance_status as enum ('present','late','absent','excused');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  email text not null unique check (length(email) between 3 and 254),
  role portal_role not null, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.departments (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  name text not null check (length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);
create table public.programs (
  id uuid primary key default gen_random_uuid(), department_id uuid not null references departments,
  code text not null unique, name text not null check (length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);
create table public.students (
  id uuid primary key references profiles, student_number text unique check (length(btrim(student_number)) between 1 and 40),
  program_id uuid references programs, created_at timestamptz not null default now()
);
create table public.faculty (
  id uuid primary key references profiles, employee_number text unique check (length(btrim(employee_number)) between 1 and 40),
  department_id uuid references departments, created_at timestamptz not null default now()
);
create table public.academic_years (
  id uuid primary key default gen_random_uuid(), label text not null unique,
  start_on date not null, end_on date not null check (end_on >= start_on),
  created_at timestamptz not null default now(),
  exclude using gist (daterange(start_on,end_on,'[]') with &&)
);
create table public.semesters (
  id uuid primary key default gen_random_uuid(), year_id uuid not null references academic_years,
  name text not null check (length(btrim(name)) between 2 and 80),
  start_on date not null, end_on date not null check (end_on >= start_on),
  created_at timestamptz not null default now(), unique (year_id,name),
  exclude using gist (daterange(start_on,end_on,'[]') with &&)
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(), department_id uuid not null references departments,
  code text not null unique, name text not null check (length(btrim(name)) between 2 and 120),
  units numeric(4,1) not null check (units > 0 and units <= 12),
  created_at timestamptz not null default now()
);
create table public.sections (
  id uuid primary key default gen_random_uuid(), name text not null check (length(btrim(name)) between 1 and 80),
  program_id uuid not null references programs, created_at timestamptz not null default now(), unique (program_id,name)
);
create table public.class_assignments (
  id uuid primary key default gen_random_uuid(), semester_id uuid not null references semesters,
  subject_id uuid not null references subjects, section_id uuid not null references sections,
  faculty_id uuid not null references faculty, created_at timestamptz not null default now(),
  unique (semester_id,subject_id,section_id), unique (id,semester_id,faculty_id,section_id),
  unique (id,semester_id,subject_id)
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references students,
  class_id uuid not null, semester_id uuid not null, subject_id uuid not null,
  status enrollment_status not null default 'enrolled', created_at timestamptz not null default now(),
  foreign key (class_id,semester_id,subject_id) references class_assignments(id,semester_id,subject_id),
  unique (student_id,semester_id,subject_id)
);
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(), class_id uuid not null, semester_id uuid not null,
  faculty_id uuid not null, section_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null, ends_at time not null check (ends_at > starts_at),
  room text not null check (length(btrim(room)) between 1 and 80),
  room_key text generated always as (lower(regexp_replace(btrim(room),'[[:space:]]+',' ','g'))) stored,
  slot numrange generated always as (numrange(extract(epoch from starts_at),extract(epoch from ends_at),'[)')) stored,
  created_at timestamptz not null default now(),
  foreign key (class_id,semester_id,faculty_id,section_id)
    references class_assignments(id,semester_id,faculty_id,section_id) on update cascade,
  exclude using gist (semester_id with =, faculty_id with =, weekday with =, slot with &&),
  exclude using gist (semester_id with =, section_id with =, weekday with =, slot with &&),
  exclude using gist (semester_id with =, room_key with =, weekday with =, slot with &&)
);
create table public.grading_scales (
  id uuid primary key default gen_random_uuid(), label text not null unique,
  grade numeric(4,2) not null unique check (grade between 0 and 10), passing boolean not null,
  created_at timestamptz not null default now()
);
insert into public.grading_scales (label,grade,passing) values
 ('1.00',1,true),('1.25',1.25,true),('1.50',1.50,true),('1.75',1.75,true),
 ('2.00',2,true),('2.25',2.25,true),('2.50',2.50,true),('2.75',2.75,true),
 ('3.00',3,true),('5.00',5,false);
create table public.grades (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null unique references enrollments,
  scale_id uuid not null references grading_scales,
  status grade_status not null default 'draft', published_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'published') = (published_at is not null))
);
create table public.attendance (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references enrollments,
  attended_on date not null, status attendance_status not null,
  created_at timestamptz not null default now(), unique (enrollment_id,attended_on)
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 160),
  body text not null check (length(btrim(body)) between 1 and 8000),
  audience portal_role, published_at timestamptz, created_at timestamptz not null default now()
);
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 160),
  description text not null default '' check (length(description) <= 2000),
  starts_on date not null, ends_on date not null check (ends_on >= starts_on),
  audience portal_role, created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles,
  title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid,
  entity text not null, entity_id uuid not null, action text not null,
  created_at timestamptz not null default now()
);

create index on programs(department_id);
create index on students(program_id);
create index on faculty(department_id);
create index on subjects(department_id);
create index on sections(program_id);
create index on class_assignments(faculty_id);
create index on class_assignments(section_id);
create index on class_assignments(subject_id);
create index on enrollments(class_id);
create index on class_schedules(class_id);
create index on grades(scale_id);
create index on announcements(published_at desc);
create index on calendar_events(starts_on);
create index on notifications(user_id,created_at desc);
create index on audit_logs(created_at desc);

create function portal_private.current_role() returns portal_role language sql stable security definer
set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and active
$$;
create function portal_private.manages_class(target uuid) returns boolean language sql stable security definer
set search_path = '' as $$
  select portal_private.current_role() = 'faculty' and exists (
    select 1 from public.class_assignments where id = target and faculty_id = (select auth.uid())
  )
$$;
create function portal_private.takes_class(target uuid) returns boolean language sql stable security definer
set search_path = '' as $$
  select portal_private.current_role() = 'student' and exists (
    select 1 from public.enrollments where class_id = target and student_id = (select auth.uid())
  )
$$;
create function portal_private.teaches_student(target uuid) returns boolean language sql stable security definer
set search_path = '' as $$
  select portal_private.current_role() = 'faculty' and exists (
    select 1 from public.enrollments e join public.class_assignments c on c.id = e.class_id
    where e.student_id = target and c.faculty_id = (select auth.uid())
  )
$$;
create function portal_private.owns_enrollment(target uuid) returns boolean language sql stable security definer
set search_path = '' as $$
  select portal_private.current_role() = 'student' and exists (
    select 1 from public.enrollments where id = target and student_id = (select auth.uid())
  )
$$;
create function portal_private.manages_enrollment(target uuid) returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (select 1 from public.enrollments
    where id = target and portal_private.manages_class(class_id))
$$;

create function portal_private.add_auth_profile() returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  assigned_role public.portal_role := (new.raw_app_meta_data ->> 'portal_role')::public.portal_role;
  actor uuid := (new.raw_app_meta_data ->> 'portal_provisioner')::uuid;
begin
  if assigned_role is null then return new; end if;
  if actor is not null and not exists (
    select 1 from public.profiles where id = actor and active and role = 'admin'
  ) then raise exception 'Provisioning requires an active administrator'; end if;
  insert into public.profiles(id, full_name, email, role)
    values (new.id,new.raw_app_meta_data ->> 'portal_name',new.email,assigned_role);
  if assigned_role = 'student' then insert into public.students(id) values(new.id);
  elsif assigned_role = 'faculty' then insert into public.faculty(id) values(new.id); end if;
  if actor is not null then
    insert into public.audit_logs(actor_id,entity,entity_id,action)
      values(actor,'profiles',new.id,'PROVISION');
  end if;
  return new;
end
$$;
create trigger portal_auth_profile after insert on auth.users
for each row execute function portal_private.add_auth_profile();

create function portal_private.sync_auth_email() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end
$$;
create trigger portal_auth_email after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function portal_private.sync_auth_email();

create function portal_private.keep_admin() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role = 'admin' and old.id = (select auth.uid()) and old.active and not new.active then
    raise exception 'You cannot deactivate your own administrator account';
  end if;
  return new;
end
$$;
create trigger keep_admin before update on profiles for each row execute function portal_private.keep_admin();

create function portal_private.validate_period() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(9134642);
  if tg_table_name = 'semesters' then
    if not exists (select 1 from public.academic_years
      where id = new.year_id and new.start_on >= start_on and new.end_on <= end_on)
    then raise exception 'Semester dates must fall within its academic year'; end if;
    if exists (select 1 from public.attendance a
      join public.enrollments e on e.id = a.enrollment_id
      where e.semester_id = new.id and a.attended_on not between new.start_on and new.end_on)
    then raise exception 'Semester dates would invalidate attendance'; end if;
  elsif exists (select 1 from public.semesters where year_id = new.id
    and (start_on < new.start_on or end_on > new.end_on))
  then raise exception 'Academic year must contain all its semesters'; end if;
  return new;
end
$$;
create trigger validate_year before update on academic_years for each row execute function portal_private.validate_period();
create trigger validate_semester before insert or update on semesters for each row execute function portal_private.validate_period();

create function portal_private.derive_class_keys() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'class_schedules' then
    select semester_id, faculty_id, section_id into strict new.semester_id,new.faculty_id,new.section_id
    from public.class_assignments where id = new.class_id;
  else
    if tg_op = 'UPDATE' and (old.student_id,old.class_id) is distinct from (new.student_id,new.class_id)
    then raise exception 'Enrollment ownership and class are immutable'; end if;
    select semester_id, subject_id into strict new.semester_id,new.subject_id
    from public.class_assignments where id = new.class_id;
    if new.status = 'withdrawn' and exists (select 1 from public.grades where enrollment_id = new.id)
    then raise exception 'Remove the grade before withdrawing this enrollment'; end if;
  end if;
  return new;
end
$$;
create trigger enrollment_keys before insert or update on enrollments for each row execute function portal_private.derive_class_keys();
create trigger schedule_keys before insert or update on class_schedules for each row execute function portal_private.derive_class_keys();

create function portal_private.validate_assignment() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.faculty_id and role = 'faculty' and active)
  then raise exception 'An active faculty account is required'; end if;
  return new;
end
$$;
create trigger validate_assignment before insert or update of faculty_id on class_assignments
for each row execute function portal_private.validate_assignment();

create function portal_private.validate_attendance() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(9134642);
  if tg_op = 'UPDATE' and (old.enrollment_id,old.attended_on) is distinct from (new.enrollment_id,new.attended_on)
  then raise exception 'Attendance enrollment and date are immutable'; end if;
  if not exists (
    select 1 from public.enrollments e join public.semesters s on s.id = e.semester_id
    where e.id = new.enrollment_id and e.status = 'enrolled' and new.attended_on between s.start_on and s.end_on
  ) then raise exception 'Attendance requires an active enrollment and a date within its semester'; end if;
  return new;
end
$$;
create trigger validate_attendance before insert or update on attendance for each row execute function portal_private.validate_attendance();

create function portal_private.validate_grade() returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  progress public.enrollment_status;
  caller public.portal_role := portal_private.current_role();
begin
  select status into progress from public.enrollments where id = new.enrollment_id for update;
  if progress is null or progress = 'withdrawn' then raise exception 'A non-withdrawn enrollment is required'; end if;
  if tg_op = 'UPDATE' and old.enrollment_id <> new.enrollment_id then raise exception 'Grade enrollment is immutable'; end if;
  if caller = 'faculty' then
    if new.status not in ('draft','submitted')
      or (tg_op = 'INSERT' and new.status <> 'draft')
      or (tg_op = 'UPDATE' and (old.status <> 'draft' or (new.status = 'submitted' and old.scale_id <> new.scale_id)))
    then raise exception 'Faculty can edit drafts and submit saved grades'; end if;
  end if;
  if caller = 'admin' and ((tg_op = 'INSERT' and new.status <> 'draft')
      or (tg_op = 'UPDATE' and new.status = 'published' and old.status = 'draft'))
  then raise exception 'Only submitted grades may be published'; end if;
  if new.status = 'published' then
    if tg_op = 'INSERT' or old.status <> 'published' then new.published_at := now();
    else new.published_at := old.published_at; end if;
  else new.published_at := null; end if;
  return new;
end
$$;
create trigger validate_grade before insert or update on grades for each row execute function portal_private.validate_grade();

create function portal_private.notify_grade() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published' or old.scale_id <> new.scale_id) then
    insert into public.notifications(user_id,title,body)
    select e.student_id, 'Grade published', s.code || ' · ' || s.name
    from public.enrollments e join public.subjects s on s.id = e.subject_id
    where e.id = new.enrollment_id;
  end if;
  return new;
end
$$;
create trigger notify_grade after insert or update on grades for each row execute function portal_private.notify_grade();

create function portal_private.capture_audit() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    insert into public.audit_logs(actor_id,entity,entity_id,action)
      values ((select auth.uid()),tg_table_name,case when tg_op = 'DELETE' then old.id else new.id end,tg_op);
  end if;
  return null;
end
$$;

do $$
declare
  resource text;
begin
  foreach resource in array array[
    'profiles','departments','programs','students','faculty','academic_years','semesters','subjects',
    'sections','class_assignments','enrollments','class_schedules','grading_scales','grades',
    'attendance','announcements','calendar_events','notifications','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security',resource);
    execute format('revoke all on public.%I from public, anon, authenticated',resource);
    execute format('grant select on public.%I to authenticated',resource);
    execute format('grant all on public.%I to service_role',resource);
    execute format('create policy admin_read on public.%I for select to authenticated using ((select portal_private.current_role()) = ''admin'')',resource);
    if resource = 'notifications' then execute 'drop policy admin_read on public.notifications'; end if;
    if resource not in ('audit_logs','notifications') then
      execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function portal_private.capture_audit()',resource);
    end if;
  end loop;
  foreach resource in array array[
    'departments','programs','academic_years','semesters','subjects','sections','class_assignments',
    'class_schedules','enrollments','grading_scales','grades','attendance','announcements','calendar_events'
  ] loop
    execute format('grant insert, update, delete on public.%I to authenticated',resource);
    execute format('create policy admin_write on public.%I for all to authenticated using ((select portal_private.current_role()) = ''admin'') with check ((select portal_private.current_role()) = ''admin'')',resource);
  end loop;
  foreach resource in array array['departments','programs','academic_years','semesters','subjects','sections','grading_scales'] loop
    execute format('create policy catalog_read on public.%I for select to authenticated using ((select portal_private.current_role()) is not null)',resource);
  end loop;
end
$$;

revoke insert, update on grades, attendance from authenticated;
grant insert (enrollment_id,scale_id,status,published_at), update (enrollment_id,scale_id,status,published_at) on grades to authenticated;
grant insert (enrollment_id,attended_on,status), update (enrollment_id,attended_on,status) on attendance to authenticated;

grant update (full_name,active) on profiles to authenticated;
grant update (student_number,program_id) on students to authenticated;
grant update (employee_number,department_id) on faculty to authenticated;
grant update (read_at) on notifications to authenticated;

create policy profile_self on profiles for select to authenticated using (id = (select auth.uid()) and active);
create policy profile_admin_update on profiles for update to authenticated
  using ((select portal_private.current_role()) = 'admin') with check ((select portal_private.current_role()) = 'admin');
create policy student_read on students for select to authenticated
  using ((id = (select auth.uid()) and (select portal_private.current_role()) = 'student') or portal_private.teaches_student(id));
create policy faculty_self on faculty for select to authenticated
  using (id = (select auth.uid()) and (select portal_private.current_role()) = 'faculty');
create policy student_admin_update on students for update to authenticated
  using ((select portal_private.current_role()) = 'admin') with check ((select portal_private.current_role()) = 'admin');
create policy faculty_admin_update on faculty for update to authenticated
  using ((select portal_private.current_role()) = 'admin') with check ((select portal_private.current_role()) = 'admin');

create policy class_read on class_assignments for select to authenticated
  using (portal_private.manages_class(id) or portal_private.takes_class(id));
create policy schedules_read on class_schedules for select to authenticated
  using (portal_private.manages_class(class_id) or portal_private.takes_class(class_id));
create policy enrollment_read on enrollments for select to authenticated
  using ((student_id = (select auth.uid()) and (select portal_private.current_role()) = 'student') or portal_private.manages_class(class_id));
create policy grade_read on grades for select to authenticated
  using ((status = 'published' and portal_private.owns_enrollment(enrollment_id)) or portal_private.manages_enrollment(enrollment_id));
create policy grade_create on grades for insert to authenticated
  with check (status = 'draft' and portal_private.manages_enrollment(enrollment_id));
create policy grade_edit on grades for update to authenticated
  using (status = 'draft' and portal_private.manages_enrollment(enrollment_id))
  with check (status in ('draft','submitted') and portal_private.manages_enrollment(enrollment_id));
create policy attendance_read on attendance for select to authenticated
  using (portal_private.owns_enrollment(enrollment_id) or portal_private.manages_enrollment(enrollment_id));
create policy attendance_create on attendance for insert to authenticated
  with check (portal_private.manages_enrollment(enrollment_id));
create policy attendance_edit on attendance for update to authenticated
  using (portal_private.manages_enrollment(enrollment_id)) with check (portal_private.manages_enrollment(enrollment_id));
create policy announcements_read on announcements for select to authenticated
  using ((select portal_private.current_role()) is not null and published_at <= now()
    and (audience is null or audience = (select portal_private.current_role())));
create policy calendar_read on calendar_events for select to authenticated
  using ((select portal_private.current_role()) is not null
    and (audience is null or audience = (select portal_private.current_role())));
create policy notification_read on notifications for select to authenticated
  using (user_id = (select auth.uid()) and (select portal_private.current_role()) is not null);
create policy notification_update on notifications for update to authenticated
  using (user_id = (select auth.uid()) and (select portal_private.current_role()) is not null)
  with check (user_id = (select auth.uid()) and (select portal_private.current_role()) is not null);

-- A projection for class rosters and instructors without exposing their account email.
create function portal_private.display_name(target uuid) returns text language sql stable security definer set search_path = '' as $$
  select full_name from public.profiles
  where id = target and (
    id = (select auth.uid()) and portal_private.current_role() is not null
    or portal_private.current_role() = 'admin'
    or portal_private.teaches_student(target)
    or exists (select 1 from public.class_assignments c where c.faculty_id = target and portal_private.takes_class(c.id))
  )
$$;
create function public.portal_display_name(target uuid) returns text language sql stable security invoker set search_path = '' as $$
  select portal_private.display_name(target)
$$;
create function public.portal_directory() returns table(id uuid, full_name text) language sql stable security invoker set search_path = '' as $$
  select directory.id, portal_private.display_name(directory.id)
  from (select student_id as id from public.enrollments union select faculty_id from public.class_assignments) directory
$$;

revoke execute on all functions in schema portal_private from public, anon, authenticated;
grant usage on schema portal_private to authenticated;
grant execute on function portal_private.current_role(), portal_private.manages_class(uuid),
  portal_private.takes_class(uuid), portal_private.teaches_student(uuid), portal_private.owns_enrollment(uuid),
  portal_private.manages_enrollment(uuid), portal_private.display_name(uuid) to authenticated;
revoke execute on function public.portal_display_name(uuid), public.portal_directory() from public, anon;
grant execute on function public.portal_display_name(uuid), public.portal_directory() to authenticated;

alter publication supabase_realtime add table public.notifications, public.announcements;
reset search_path;
