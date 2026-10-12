import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { ensureCaptureOutDir, resolveCaptureOutDir } from './captureOutDir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = resolveCaptureOutDir();
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';
const DEV_USER_ID = '00000000-0000-4000-a000-000000000001';

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function supabaseStorageKey(supabaseUrl) {
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}

function buildSession(tipoPerfil) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: 'dev-capture-access-token',
    refresh_token: 'dev-capture-refresh-token',
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: DEV_USER_ID,
      email: tipoPerfil === 'Motorista' ? 'motorista@boleia.dev' : 'passageiro@boleia.dev',
      user_metadata: { tipo_perfil: tipoPerfil },
      app_metadata: { provider: 'email' },
    },
  };
}

function perfilRow(tipoPerfil) {
  return {
    id: DEV_USER_ID,
    nome_completo: tipoPerfil === 'Motorista' ? 'Paulo Manuel Domingos' : 'Ana Passageira',
    tipo_perfil: tipoPerfil,
    perfil_completo: true,
    onboarding_completed: true,
    avatar_url: null,
    iban: tipoPerfil === 'Motorista' ? 'AO06004000000000000000000' : null,
    iban_titular: tipoPerfil === 'Motorista' ? 'Paulo Manuel Domingos' : null,
    is_admin: false,
  };
}

async function installSupabaseMocks(page, supabaseUrl, tipoPerfil) {
  const row = perfilRow(tipoPerfil);
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.includes('supabase.co')) {
      await route.continue();
      return;
    }
    const method = route.request().method();

    if (url.includes('/auth/v1/user') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: buildSession(tipoPerfil).user }),
      });
      return;
    }

    if (url.includes('/rest/v1/rpc/get_own_perfil_contacto')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          telefone: '+244925678901',
          iban: row.iban,
        }),
      });
      return;
    }

    if (url.includes('/rest/v1/perfis') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(row),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    localStorage.setItem('pwa-install-dismissed-v1', '1');
  }, {
    storageKey: supabaseStorageKey(supabaseUrl),
    session: buildSession(tipoPerfil),
  });
}

async function applyTheme(page, theme) {
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, theme === 'dark');
  await page.waitForTimeout(120);
}

const shots = [
  { width: 320, theme: 'light', role: 'passageiro' },
  { width: 320, theme: 'dark', role: 'passageiro' },
  { width: 390, theme: 'light', role: 'passageiro' },
  { width: 390, theme: 'dark', role: 'passageiro' },
  { width: 430, theme: 'light', role: 'passageiro' },
  { width: 430, theme: 'dark', role: 'passageiro' },
  { width: 320, theme: 'light', role: 'motorista' },
  { width: 320, theme: 'dark', role: 'motorista' },
  { width: 390, theme: 'light', role: 'motorista' },
  { width: 390, theme: 'dark', role: 'motorista' },
  { width: 430, theme: 'light', role: 'motorista' },
  { width: 430, theme: 'dark', role: 'motorista' },
];

async function main() {
  const env = loadEnvLocal();
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
  ensureCaptureOutDir(OUT);

  const browser = await chromium.launch();
  const md5Lines = [];

  const widthFilter = process.env.CAPTURE_WIDTH ? Number(process.env.CAPTURE_WIDTH, 10) : null;

  for (const shot of shots) {
    if (widthFilter && shot.width !== widthFilter) {
      continue;
    }
    const tipoPerfil = shot.role === 'motorista' ? 'Motorista' : 'Passageiro';
    const file = `perfil-v2-${shot.width}-${shot.theme}-${shot.role}.png`;
    const context = await browser.newContext({
      viewport: { width: shot.width, height: 844 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await installSupabaseMocks(page, supabaseUrl, tipoPerfil);
    const devPath = shot.role === 'motorista' ? '/__dev/perfil-motorista' : '/__dev/perfil';
    await page.goto(`${BASE}${devPath}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=O meu perfil', { timeout: 15000 });
    await applyTheme(page, shot.theme);
    const outPath = path.join(OUT, file);
    await page.screenshot({ path: outPath, fullPage: true });
    const md5 = createHash('md5').update(fs.readFileSync(outPath)).digest('hex');
    md5Lines.push(`${file} ${md5}`);
    console.log('saved', file, md5);
    await context.close();
  }

  const allMd5Lines = shots.map((shot) => {
    const file = `perfil-v2-${shot.width}-${shot.theme}-${shot.role}.png`;
    const outPath = path.join(OUT, file);
    const md5 = createHash('md5').update(fs.readFileSync(outPath)).digest('hex');
    return `${file} ${md5}`;
  });
  fs.writeFileSync(path.join(OUT, 'perfil-v2-md5.txt'), `${allMd5Lines.join('\n')}\n`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
