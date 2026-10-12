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
/**
 * @param {import('playwright').Page} page
 * @param {string} label
 */
async function openCriarProcuraField(page, label) {
  await page.locator('button:has-text("Criar procura")').first().click();
  const input = page.locator(`label:has-text("${label}") [role="combobox"]`).first();
  await input.click();
  return input;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} label
 */
async function openNoResultsState(page, label) {
  const input = await openCriarProcuraField(page, label);
  await input.fill(NO_RESULTS_QUERY);
  await page.waitForTimeout(1200);
  await page.waitForSelector('[data-testid="geocoder-empty-state"]', { timeout: 20000 });
}

/**
 * @param {import('playwright').Page} page
 */
async function installPhotonAbort(page) {
  await page.route('**/photon.komoot.io/**', (route) => route.abort('failed'));
}

/**
 * @param {import('playwright').Page} page
 * @param {string} label
 */
async function openNetworkErrorState(page, label) {
  await installPhotonAbort(page);
  const input = await openCriarProcuraField(page, label);
  await input.fill('Viana');
  await page.waitForTimeout(1200);
  await page.waitForSelector('[data-testid="geocoder-network-error"]', { timeout: 20000 });
}

/**
 * @param {'light' | 'dark'} theme
 */
async function captureTheme(theme) {
  const env = loadEnvLocal();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL em falta em .env.local');
  }

  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: theme,
  });

  const emptyPage = await context.newPage();
  await installSession(emptyPage, supabaseUrl, theme);
  await emptyPage.goto(`${BASE}/passageiro`, { waitUntil: 'networkidle' });
  await openNoResultsState(emptyPage, 'Origem');
  const emptyPath = path.join(OUT, `ux-criar-procura-sem-resultados-${theme}-390.png`);
  await emptyPage.screenshot({ path: emptyPath, fullPage: false });
  await emptyPage.close();

  const networkPage = await context.newPage();
  await installSession(networkPage, supabaseUrl, theme);
  await networkPage.goto(`${BASE}/passageiro`, { waitUntil: 'networkidle' });
  await openNetworkErrorState(networkPage, 'Origem');
  const networkPath = path.join(OUT, `ux-criar-procura-erro-rede-${theme}-390.png`);
  await networkPage.screenshot({ path: networkPath, fullPage: false });
  await networkPage.close();

  await browser.close();
  return { emptyPath, networkPath };
}

const light = await captureTheme('light');
const dark = await captureTheme('dark');

console.log(JSON.stringify({
  semResultados: {
    light: { path: light.emptyPath, md5: md5File(light.emptyPath) },
    dark: { path: dark.emptyPath, md5: md5File(dark.emptyPath) },
  },
  erroRede: {
    light: { path: light.networkPath, md5: md5File(light.networkPath) },
    dark: { path: dark.networkPath, md5: md5File(dark.networkPath) },
  },
}, null, 2));
