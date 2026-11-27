-- Fictional records. Run after the demo Auth accounts exist. Safe to re-run on the same demo database.
do $$
declare
  it uuid;
  education uuid;
  bsit uuid;
  bsed uuid;
  current_year uuid;
  past_year uuid;
  term uuid;
  history_term uuid;
  current_section uuid;
  other_section uuid;
  web uuid;
  networks uuid;
  data_subject uuid;
  web_class uuid;
  network_class uuid;
  history_class uuid;
  other_class uuid;
  demo_student uuid := (select id from profiles where email = 'student@dhvsu-demo.example');
  peer_id uuid := (select id from profiles where email = 'peer@dhvsu-demo.example');
  instructor uuid := (select id from profiles where email = 'faculty@dhvsu-demo.example');
  other_instructor uuid := (select id from profiles where email = 'other-faculty@dhvsu-demo.example');
  web_enrollment uuid;
  network_enrollment uuid;
  history_enrollment uuid;
  anchor date := (date_trunc('year', current_date) + interval '6 months')::date;
  now_term date;
  period_date date;
  future_day date := current_date + 9;
begin
  if demo_student is null or peer_id is null or instructor is null or other_instructor is null then
    raise exception 'Create the demo Auth accounts before loading academic records';
  end if;
  if current_date < anchor then anchor := (anchor - interval '1 year')::date; end if;
  now_term := case when current_date >= (anchor + interval '6 months')::date
    then (anchor + interval '6 months')::date else anchor end;
  period_date := greatest(now_term, current_date - 4);

  insert into departments(code,name) values ('DEMO-CCS','College of Computing Studies')
    on conflict(code) do update set name = excluded.name returning id into it;
  insert into departments(code,name) values ('DEMO-CE','College of Education')
    on conflict(code) do update set name = excluded.name returning id into education;
  insert into programs(code,name,department_id) values ('DEMO-BSIT','Bachelor of Science in Information Technology',it)
    on conflict(code) do update set name = excluded.name returning id into bsit;
  insert into programs(code,name,department_id) values ('DEMO-BSED','Bachelor of Secondary Education',education)
    on conflict(code) do update set name = excluded.name returning id into bsed;

  update students set student_number = 'DEMO-26-0104', program_id = bsit where id = demo_student;
  update students set student_number = 'DEMO-26-0105', program_id = bsed where id = peer_id;
  update faculty set employee_number = 'DEMO-F-025', department_id = it where id = instructor;
  update faculty set employee_number = 'DEMO-F-026', department_id = education where id = other_instructor;

  insert into academic_years(label,start_on,end_on) values
    (extract(year from anchor)::text || '–' || (extract(year from anchor) + 1)::text, anchor, (anchor + interval '1 year - 1 day')::date)
    on conflict(label) do update set label = excluded.label returning id into current_year;
  insert into academic_years(label,start_on,end_on) values
    ((extract(year from anchor) - 1)::text || '–' || extract(year from anchor)::text, (anchor - interval '1 year')::date, anchor - 1)
    on conflict(label) do update set label = excluded.label returning id into past_year;
  insert into semesters(year_id,name,start_on,end_on) values
    (current_year,'First semester',anchor,(anchor + interval '6 months - 1 day')::date),
    (current_year,'Second semester',(anchor + interval '6 months')::date,(anchor + interval '1 year - 1 day')::date)
    on conflict(year_id,name) do nothing;
  select id into term from semesters where year_id = current_year and start_on = now_term;
  insert into semesters(year_id,name,start_on,end_on) values
    (past_year,'Second semester',(anchor - interval '6 months')::date,anchor - 1)
    on conflict(year_id,name) do update set name = excluded.name returning id into history_term;

  insert into sections(name,program_id) values ('BSIT 3A',bsit)
    on conflict(program_id,name) do update set name = excluded.name returning id into current_section;
  insert into sections(name,program_id) values ('BSED 2B',bsed)
    on conflict(program_id,name) do update set name = excluded.name returning id into other_section;
  insert into subjects(code,name,units,department_id) values ('WEB 312','Web Systems and Technologies',3,it)
    on conflict(code) do update set name = excluded.name returning id into web;
  insert into subjects(code,name,units,department_id) values ('NET 313','Advanced Networking',3,it)
    on conflict(code) do update set name = excluded.name returning id into networks;
  insert into subjects(code,name,units,department_id) values ('DATA 221','Database Systems',4,it)
    on conflict(code) do update set name = excluded.name returning id into data_subject;

  insert into class_assignments(semester_id,subject_id,section_id,faculty_id) values (term,web,current_section,instructor)
    on conflict(semester_id,subject_id,section_id) do update set section_id = excluded.section_id returning id into web_class;
  insert into class_assignments(semester_id,subject_id,section_id,faculty_id) values (term,networks,current_section,instructor)
    on conflict(semester_id,subject_id,section_id) do update set section_id = excluded.section_id returning id into network_class;
  insert into class_assignments(semester_id,subject_id,section_id,faculty_id) values (history_term,data_subject,current_section,instructor)
    on conflict(semester_id,subject_id,section_id) do update set section_id = excluded.section_id returning id into history_class;
  insert into class_assignments(semester_id,subject_id,section_id,faculty_id) values (term,networks,other_section,other_instructor)
    on conflict(semester_id,subject_id,section_id) do update set section_id = excluded.section_id returning id into other_class;

  insert into class_schedules(class_id,weekday,starts_at,ends_at,room) values
    (web_class,1,'09:00','10:30','Demo Lab 2'),(web_class,3,'09:00','10:30','Demo Lab 2'),
    (network_class,2,'13:30','15:00','Demo Lab 4'),(other_class,2,'13:30','15:00','Demo Room 6')
    on conflict do nothing;
  insert into enrollments(student_id,class_id) values (demo_student,web_class)
    on conflict(student_id,semester_id,subject_id) do update set status = enrollments.status returning id into web_enrollment;
  insert into enrollments(student_id,class_id) values (demo_student,network_class)
    on conflict(student_id,semester_id,subject_id) do update set status = enrollments.status returning id into network_enrollment;
  insert into enrollments(student_id,class_id,status) values (demo_student,history_class,'completed')
    on conflict(student_id,semester_id,subject_id) do update set status = enrollments.status returning id into history_enrollment;
  insert into enrollments(student_id,class_id) values (peer_id,other_class)
    on conflict(student_id,semester_id,subject_id) do nothing;

  insert into grades(enrollment_id,scale_id,status) values
    (web_enrollment,(select id from grading_scales where label = '1.50'),'published'),
    (history_enrollment,(select id from grading_scales where label = '1.25'),'published')
    on conflict(enrollment_id) do nothing;
  insert into attendance(enrollment_id,attended_on,status) values
    (web_enrollment,period_date,'present'),(network_enrollment,period_date,'late')
    on conflict(enrollment_id,attended_on) do nothing;
  insert into announcements(id,title,body,audience,published_at) values
    ('00000000-0000-4000-8000-003300003001','Enrollment services schedule','The fictional registrar help desk is open Monday to Friday. Check your enrolled subjects and contact the demo registrar if a class is missing.',null,now() - interval '1 day'),
    ('00000000-0000-4000-8000-003300003002','Library research orientation','Reserve time for the academic databases and citations workshop in the demo library.',null,now() - interval '2 days'),
    ('00000000-0000-4000-8000-003300003003','Faculty grade review','Submit draft grades for registrar review when your class records are ready.','faculty',now() - interval '3 days')
    on conflict(id) do nothing;
  insert into calendar_events(id,title,description,starts_on,ends_on) values
    ('00000000-0000-4000-8000-003300004001','Research orientation','Demo library workshop',future_day,future_day),
    ('00000000-0000-4000-8000-003300004002','Academic advising week','Fictional course planning appointments',future_day+5,future_day+9)
    on conflict(id) do nothing;
end
$$;
