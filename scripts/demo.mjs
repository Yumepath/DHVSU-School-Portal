import { spawnSync } from 'node:child_process';
import { createAccount, demoIdentities, serviceClient } from './accounts.mjs';

const local = /^(localhost|127\.0\.0\.1)$/;
const url = process.env.LOCAL_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const database = process.env.LOCAL_SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!local.test(new URL(url).hostname) || !local.test(new URL(database).hostname)) {
  throw new Error('Shared demo credentials can only be installed into a local stack.');
}
const checkPsql = spawnSync('psql', ['--version'], { stdio: 'ignore' });
if (checkPsql.status !== 0) throw new Error('Install psql and add it to PATH to load the local SQL seed.');
const client = serviceClient(url, process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY);
for (const identity of demoIdentities) {
  const { data, error } = await client.from('profiles').select('role').eq('email', identity.email).maybeSingle();
  if (error) throw error;
  if (data && data.role !== identity.role) throw new Error('Demo role differs from the existing account for ' + identity.email);
  if (!data) await createAccount(client, { ...identity, password: 'Local-Demo!2026' });
}
const load = spawnSync('psql', [database, '-X', '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/seed.sql'], { stdio: 'inherit' });
if (load.status !== 0) process.exit(load.status ?? 1);
console.log('Local fictional records are ready. See README for demo sign-ins.');
