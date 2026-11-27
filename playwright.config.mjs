import { defineConfig } from '@playwright/test';
import { loadEnvFile } from 'node:process';

function loadOptional(name) {
  try { loadEnvFile(name); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
loadOptional('.env');
if (process.env.SUPABASE_URL?.startsWith('https://')) loadOptional('.env.hosted-demo');
const port = process.env.PREVIEW_PORT ?? '4200';
const url = 'http://127.0.0.1:' + port;
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 70_000,
  expect: { timeout: 13_000 },
  use: {
    baseURL: url,
    viewport: { width: 1440, height: 1030 },
    timezoneId: 'Asia/Manila',
    colorScheme: 'light',
    ...(process.platform === 'win32' && !process.env.PLAYWRIGHT_CHROMIUM ? { channel: 'msedge' } : {}),
  },
  webServer: {
    command: 'node scripts/preview.mjs',
    url,
    reuseExistingServer: false,
  },
});
