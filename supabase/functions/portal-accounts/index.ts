import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Cache-Control': 'no-store',
};

const response = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: cors });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return response(405, { error: 'Use POST.' });
  const match = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i);
  if (!match) return response(401, { error: 'Sign in to provision accounts.' });

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const callerKey = request.headers.get('apikey');
  if (!url || !key) return response(503, { error: 'Account provisioning is unavailable.' });
  if (!callerKey) return response(401, { error: 'Missing API key.' });

  const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  const caller = createClient(url, callerKey, {
    auth: authOptions, global: { headers: { Authorization: 'Bearer ' + match[1] } },
  });
  const { data: identity, error: authError } = await caller.auth.getUser(match[1]);
  if (authError || !identity.user) return response(401, { error: 'Sign in to provision accounts.' });
  const { data: profile } = await caller.from('profiles').select('role,active').eq('id', identity.user.id).maybeSingle();
  if (profile?.role !== 'admin' || !profile.active) return response(403, { error: 'Administrator access is required.' });

  const payload = await request.json().catch(() => null);
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const name = typeof payload?.full_name === 'string' ? payload.full_name.trim() : '';
  const role = payload?.role;
  const password = typeof payload?.password === 'string' ? payload.password : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || name.length > 120 ||
      !['student', 'faculty', 'admin'].includes(role) || password.length < 12 || new TextEncoder().encode(password).length > 72) {
    return response(400, { error: 'Enter a valid name, email, role, and password of 12–72 bytes.' });
  }
  const admin = createClient(url, key, { auth: authOptions });
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { portal_role: role, portal_name: name, portal_provisioner: identity.user.id },
  });
  if (error) {
    if (error.code === 'email_exists' || error.code === 'user_already_exists') {
      return response(409, { error: 'An account already uses this email address.' });
    }
    if (error.code === 'weak_password') return response(400, { error: 'The password does not meet the project requirements.' });
    return response(422, { error: 'Supabase could not create this account. Check Auth settings and logs.' });
  }
  const id = data.user?.id;
  if (!id) return response(502, { error: 'Auth did not return an account ID.' });
  const { data: account } = await admin.from('profiles').select('id').eq('id', id).maybeSingle();
  if (!account) return response(502, { error: 'The Auth account is missing its portal profile. Review the database migrations.' });
  return response(201, { id });
});
