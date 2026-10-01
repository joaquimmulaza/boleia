#!/usr/bin/env node
/**
 * Actualiza Site URL e Redirect URLs do Supabase Auth (Management API).
 * Uso: SUPABASE_ACCESS_TOKEN=... node scripts/update-supabase-auth-urls.mjs
 */
const PROJECT_REF = 'fdclrbcgytnuqcrpsevw';
const SITE_URL = 'https://boleia-cyan.vercel.app';
const REQUIRED_REDIRECTS = [
  'https://boleia-cyan.vercel.app/auth?mode=update-password',
  'http://localhost:5173/auth?mode=update-password',
  'https://boleia-cyan.vercel.app/auth',
  'http://localhost:5173/auth',
  'http://127.0.0.1:5173/auth',
];

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Defina SUPABASE_ACCESS_TOKEN (Personal Access Token do Supabase Dashboard).');
  process.exit(1);
}

const base = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const getConfig = async () => {
  const res = await fetch(base, { headers });
  if (!res.ok) throw new Error(`GET auth config failed: ${res.status} ${await res.text()}`);
  return res.json();
};

const patchConfig = async (payload) => {
  const res = await fetch(base, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH auth config failed: ${res.status} ${await res.text()}`);
  return res.json();
};

const main = async () => {
  const before = await getConfig();
  console.log('BEFORE site_url:', before.site_url);
  console.log('BEFORE uri_allow_list:', before.uri_allow_list);

  const current = (before.uri_allow_list || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  for (const url of REQUIRED_REDIRECTS) {
    if (!current.includes(url)) current.push(url);
  }

  const after = await patchConfig({
    site_url: SITE_URL,
    uri_allow_list: current.join(','),
  });

  console.log('AFTER site_url:', after.site_url);
  console.log('AFTER uri_allow_list:', after.uri_allow_list);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
