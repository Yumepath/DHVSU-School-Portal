import { writeFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
if (url && !/^https:\/\/[^/]+$|^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) {
  throw new Error('SUPABASE_URL must be an HTTPS origin or a local Supabase URL.');
}
if (key && !key.startsWith('sb_publishable_')) {
  // Local CLI stacks may provide a legacy anon JWT.
  const claims = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString());
  if (claims.role !== 'anon') throw new Error('Configure a publishable or legacy anon key.');
}
if (Boolean(url) !== Boolean(key)) throw new Error('Set both Supabase environment variables.');
await writeFile('src/environments/supabase.generated.ts',
  'export const config = ' + JSON.stringify({ url, key }, null, 2) + ' as const;\n');
