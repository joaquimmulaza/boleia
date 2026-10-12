import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.CAPTURE_OUT_DIR || '/opt/cursor/artifacts';
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  /** @type {Record<string, string>} */
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

function buildSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: 'dev-capture-access-token',
    refresh_token: 'dev-capture-refresh-token',
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-4000-a000-000000000001',
      email: 'captura@boleia.dev',
      user_metadata: { tipo_perfil: 'Passageiro' },
      app_metadata: { provider: 'email' },
    },
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} supabaseUrl
 * @param {'light' | 'dark'} theme
 */
async function installSession(page, supabaseUrl, theme) {
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
        body: JSON.stringify({ user: buildSession().user }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.addInitScript(({ storageKey, session, themeValue }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    localStorage.setItem('theme', themeValue);
    localStorage.setItem('pwa-install-dismissed-v1', '1');
  }, {
    storageKey: supabaseStorageKey(supabaseUrl),
    session: buildSession(),
    themeValue: theme,
  });
}

/**
 * @param {string} filePath
 */
function md5File(filePath) {
  const hash = crypto.createHash('md5');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * @param {import('playwright').Page} page
 * @param {string} label
 */
const NO_RESULTS_QUERY = 'ZZZZZZZZZZZZZZZ';

/**
 * @param {import('playwright').Page} page
 * @param {string} label
 */
async function openNoResultsState(page, label) {
  await page.locator('button:has-text("Criar procura")').first().click();
  const input = page.locator(`label:has-text("${label}") input`).first();
  await input.click();
  await input.fill(NO_RESULTS_QUERY);
  await page.waitForTimeout(1200);
  await page.waitForSelector('text=Não encontrámos este local', { timeout: 20000 });
}

async function capture(theme) {
  const env = loadEnvLocal();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL em falta em .env.local');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  await installSession(page, supabaseUrl, theme);

  await page.goto(`${BASE}/passageiro`, { waitUntil: 'networkidle' });
  await openNoResultsState(page, 'Origem');

  fs.mkdirSync(OUT, { recursive: true });
  const outPath = path.join(OUT, `ux-criar-procura-sem-resultados-${theme}-390.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  await browser.close();
  return outPath;
}

const lightPath = await capture('light');
const darkPath = await capture('dark');

console.log(JSON.stringify({
  light: { path: lightPath, md5: md5File(lightPath) },
  dark: { path: darkPath, md5: md5File(darkPath) },
}, null, 2));
