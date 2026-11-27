import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { demoIdentities } from '../scripts/accounts.mjs';

const db = new PGlite({ extensions: { btree_gist } });
const base = new URL('../supabase/', import.meta.url);
const [student, faculty, admin, peer, otherFaculty] = demoIdentities.map((_, i) =>
  '00000000-0000-4000-8000-00000000000' + (i + 1));
const ids = [student, faculty, admin, peer, otherFaculty];

async function actor(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  if (id) await db.exec('set role authenticated');
}
const get = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await get(sql, params))[0];
const expected = async (sql, args, pattern) => assert.rejects(db.query(sql, args), pattern);

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema extensions;
    create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create table auth.users(id uuid primary key, email text unique, raw_app_meta_data jsonb, raw_user_meta_data jsonb);
    create publication supabase_realtime;
  `);
  const migrations = new URL('migrations/', base);
  for (const name of (await readdir(migrations)).sort()) {
    await db.exec(await readFile(new URL(name, migrations), 'utf8'));
  }
  for (const [index, entry] of demoIdentities.entries()) {
    await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [
      ids[index], entry.email, { portal_role: entry.role, portal_name: entry.name },
    ]);
  }
  await db.exec(await readFile(new URL('seed.sql', base), 'utf8'));
  await db.exec(await readFile(new URL('seed.sql', base), 'utf8'));
});

after(async () => db.close());

test('anonymous catalog is inaccessible and user metadata cannot create an administrator', async () => {
  await actor();
  await db.exec('set role anon');
  await expected('select * from public.subjects', [], /permission denied/);
  await actor();
  const outsider = '00000000-0000-4000-8000-000000000006';
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',
    [outsider, 'outsider@example.test', { portal_role: 'admin', portal_name: 'Spoofed Role' }]);
  await actor(outsider);
  assert.deepEqual(await get('select id from profiles'), []);
  assert.deepEqual(await get('select id from subjects'), []);
});

test('students see their own records and cannot change roles, peer data, or published grades', async () => {
  await actor(student);
  assert.deepEqual(await get('select id from profiles'), [{ id: student }]);
  const enrollment = await get('select student_id,status from enrollments');
  assert.equal(enrollment.length, 3);
  assert.ok(enrollment.every(row => row.student_id === student));
  assert.equal((await get('select id from grades')).length, 2);
  assert.equal((await get('select id from attendance')).length, 2);
  assert.equal((await get('select * from portal_directory()')).find(row => row.id === faculty).full_name, 'Rafael Mercado');
  assert.equal(await one('select id from students where id=$1', [peer]), undefined);
  await expected("update profiles set role='admin' where id=$1", [student], /permission denied/);
  assert.deepEqual(await get("update grades set status='draft' returning id"), []);
  assert.deepEqual(await get("update profiles set full_name='Changed' where id=$1 returning id", [student]), []);
});

test('faculty can encode and submit assigned grades, while the admin alone publishes them', async () => {
  await actor(admin);
  const pending = await one("select e.id from enrollments e join subjects s on s.id=e.subject_id where student_id=$1 and code='NET 313'", [student]);
  const other = await one('select id from enrollments where student_id=$1', [peer]);
  const option = await one("select id from grading_scales where label='2.00'");
  await actor(faculty);
  assert.equal((await get('select id from enrollments')).length, 3);
  assert.equal(await one('select id from enrollments where id=$1', [other.id]), undefined);
  await expected("insert into grades(enrollment_id,scale_id) values($1,$2)", [other.id, option.id], /row-level security/i);
  const grade = await one(`insert into grades(enrollment_id,scale_id,status,published_at) values($1,$2,'draft',null)
    on conflict(enrollment_id) do update set scale_id=excluded.scale_id,status=excluded.status,published_at=excluded.published_at returning id`, [pending.id, option.id]);
  await expected("update grades set status='published' where id=$1", [grade.id], /Faculty can edit drafts and submit saved grades/);
  await one("update grades set status='submitted' where id=$1 returning id", [grade.id]);
  assert.deepEqual(await get("update grades set status='draft' where id=$1 returning id", [grade.id]), []);
  await actor(student);
  assert.equal(await one('select id from grades where id=$1', [grade.id]), undefined);
  await actor(otherFaculty);
  assert.equal(await one('select id from grades where id=$1', [grade.id]), undefined);
  await actor(admin);
  assert.equal((await one("update grades set status='published' where id=$1 returning status", [grade.id])).status, 'published');
  assert.ok(await one("select id from audit_logs where entity='grades' and actor_id=$1", [admin]));
  await actor(student);
  assert.equal((await one('select id from grades where id=$1', [grade.id])).id, grade.id);
  const notice = await one("select id from notifications where body like 'NET 313%'");
  assert.ok(notice);
  assert.ok((await one('update notifications set read_at=now() where id=$1 returning read_at', [notice.id])).read_at);
  await actor(peer);
  assert.deepEqual(await get('select id from notifications where id=$1', [notice.id]), []);
});

test('timetabling and enrollment enforce ownership, valid terms, and collision rules', async () => {
  await actor(admin);
  const row = await one(`select e.id, e.class_id, e.student_id, s.start_on, s.end_on
    from enrollments e join semesters s on s.id=e.semester_id where e.student_id=$1 and e.status='enrolled' limit 1`, [student]);
  await expected('insert into enrollments(student_id,class_id) values($1,$2)', [row.student_id, row.class_id], /duplicate key/);
  const existing = await one('select * from class_schedules where class_id=$1 limit 1', [row.class_id]);
  await expected('insert into class_schedules(class_id,weekday,starts_at,ends_at,room) values($1,$2,$3,$4,$5)',
    [row.class_id, existing.weekday, existing.starts_at, existing.ends_at, 'Different room'], /exclusion constraint/);
  const conflicting = await one('select id,faculty_id from class_assignments where id in (select class_id from enrollments where student_id=$1)', [peer]);
  await expected('update class_assignments set faculty_id=$1 where id=$2', [faculty, conflicting.id], /exclusion constraint/);
  await actor(faculty);
  await expected("insert into attendance(enrollment_id,attended_on,status) values($1,$2::date - 1,'present')", [row.id, row.start_on], /within its semester/);
  const updated = await one(`insert into attendance(enrollment_id,attended_on,status) values($1,$2,'excused')
    on conflict(enrollment_id,attended_on) do update set status=excluded.status returning status`, [row.id, row.end_on]);
  assert.equal(updated.status, 'excused');
});

test('announcements are filtered by role and publication time; deactivation stops an existing session', async () => {
  await actor(admin);
  await one("insert into announcements(title,body,audience) values('Private draft','Unpublished content','student') returning id");
  await one("insert into announcements(title,body,audience,published_at) values('Registrar notice','Published content','student',now()) returning id");
  await expected('update profiles set active=false where id=$1', [admin], /own administrator/);
  await actor(student);
  const notices = (await get('select title from announcements')).map(row => row.title);
  assert.ok(notices.includes('Registrar notice'));
  assert.ok(!notices.includes('Private draft') && !notices.includes('Faculty grade review'));
  await actor(faculty);
  assert.equal(await one("select id from announcements where title='Registrar notice'"), undefined);
  await actor(admin);
  await one('update profiles set active=false where id=$1 returning id', [student]);
  await actor(student);
  assert.deepEqual(await get('select id from profiles'), []);
  assert.deepEqual(await get('select id from enrollments'), []);
  assert.deepEqual(await get('select id from announcements'), []);
  await actor(admin);
  await one('update profiles set active=true where id=$1 returning id', [student]);
});




test('Auth Admin metadata supplied after account creation provisions one profile and audit event', async () => {
  await actor();
  const newcomer = '00000000-0000-4000-8000-000000000007';
  const app = { portal_role: 'student', portal_name: 'Demo Learner', portal_provisioner: admin };
  await db.query("insert into auth.users(id,email) values($1,'new@example.test')", [newcomer]);
  await db.query('update auth.users set raw_app_meta_data=$1 where id=$2', [app, newcomer]);
  await db.query('update auth.users set raw_app_meta_data=$1 where id=$2', [app, newcomer]);
  assert.equal((await one('select role from profiles where id=$1', [newcomer])).role, 'student');
  assert.ok(await one('select id from students where id=$1', [newcomer]));
  assert.equal((await get("select id from audit_logs where action='PROVISION' and entity_id=$1", [newcomer])).length, 1);
});
