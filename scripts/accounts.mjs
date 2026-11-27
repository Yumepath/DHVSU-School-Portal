import { createClient } from '@supabase/supabase-js';

export const demoIdentities = [
  { role: 'student', email: 'student@dhvsu-demo.example', name: 'Maya Serrano' },
  { role: 'faculty', email: 'faculty@dhvsu-demo.example', name: 'Rafael Mercado' },
  { role: 'admin', email: 'admin@dhvsu-demo.example', name: 'Avery Santiago' },
  { role: 'student', email: 'peer@dhvsu-demo.example', name: 'Isla de Vera' },
  { role: 'faculty', email: 'other-faculty@dhvsu-demo.example', name: 'Noel Aragon' },
];

export function serviceClient(url, key) {
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local terminal.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createAccount(client, { email, name, role, password }) {
  if (password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('Use a password of 12–72 bytes.');
  const { data, error } = await client.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { portal_name: name, portal_role: role },
  });
  if (error) throw error;
  return data.user.id;
}
