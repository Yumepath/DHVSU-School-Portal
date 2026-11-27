import { createAccount, serviceClient } from './accounts.mjs';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORTAL_ADMIN_EMAIL, PORTAL_ADMIN_NAME, PORTAL_ADMIN_PASSWORD } = process.env;
if (!PORTAL_ADMIN_EMAIL || !PORTAL_ADMIN_NAME || !PORTAL_ADMIN_PASSWORD) {
  throw new Error('Set PORTAL_ADMIN_EMAIL, PORTAL_ADMIN_NAME and PORTAL_ADMIN_PASSWORD in your local terminal.');
}
await createAccount(serviceClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
  { email: PORTAL_ADMIN_EMAIL, name: PORTAL_ADMIN_NAME, password: PORTAL_ADMIN_PASSWORD, role: 'admin' });
console.log('Administrator created. Sign in with the email and password you supplied.');
