import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = 'www';
const files = await readdir(root, { recursive: true, withFileTypes: true });
const forbidden = /^(?:\.env(?:\.|$)|node_modules$|supabase$|tests$|\.git$)|\.map$/;
for (const entry of files) {
  assert(!forbidden.test(entry.name), 'Unexpected public output: ' + entry.name);
}
const index = await readFile(join(root, 'index.html'), 'utf8');
assert.match(index, /<title>DHVSU School Portal<\/title>/);
for (const [, asset] of index.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png))"/g)) {
  await readFile(join(root, asset));
}
const redirects = await readFile(join(root, '_redirects'), 'utf8');
for (const route of ['/portal/*', '/sign-in', '/reset-password']) {
  assert(redirects.includes(route + ' /index.html 200'), 'Missing SPA rewrite for ' + route);
}
const headers = await readFile(join(root, '_headers'), 'utf8');
assert.match(headers, /X-Frame-Options: DENY/);
for (const entry of files.filter(entry => entry.name.endsWith('.js'))) {
  const source = await readFile(join(entry.parentPath, entry.name), 'utf8');
  assert(!/sb_secret_[A-Za-z0-9_-]{20,}/.test(source), 'Privileged secret found in browser bundle');
}
console.log('Validated public assets, SPA rewrites, and bundle boundaries.');
