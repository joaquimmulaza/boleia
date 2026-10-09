import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = '/opt/cursor/artifacts';
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';

const DEV_USER_ID = '00000000-0000-4000-a000-000000000001'; // alinhado a DevPerfilCapture

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }
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
      id: DEV_USER_ID,
      email: 'captura@boleia.dev',
      user_metadata: { tipo_perfil: 'Passageiro' },
      app_metadata: { provider: 'email' },
    },
  };
}

const perfilRow = {
  id: DEV_USER_ID,
  nome_completo: 'Captura Visual',
  tipo_perfil: 'Passageiro',
  perfil_completo: true,
  onboarding_completed: true,
  avatar_url: null,
  iban: null,
  iban_titular: null,
  is_admin: false,
};

/**
 * @param {import('playwright').Page} page
 * @param {string} supabaseUrl
 * @param {{ pushSubscribed?: boolean }} opts
 */
async function installSupabaseMocks(page, supabaseUrl, opts = {}) {
  const { pushSubscribed = false } = opts;
  const origin = new URL(supabaseUrl).origin;

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

    if (url.includes('/auth/v1/user/identities') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ identities: [{ provider: 'email', id: 'email-dev' }] }),
      });
      return;
    }

    if (url.includes('/rest/v1/rpc/get_own_perfil_contacto')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ telefone: '+244923000000', iban: null }),
      });
      return;
    }

    if (url.includes('/rest/v1/perfis') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(perfilRow),
      });
      return;
    }

    if (url.includes('/rest/v1/push_subscriptions') && method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'dev-push-sub' }),
      });
      return;
    }

    if (url.includes('/rest/v1/push_subscriptions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (url.includes('/rest/v1/notificacoes')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.addInitScript(({ storageKey, session, subscribed }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    localStorage.setItem('pwa-install-dismissed-v1', '1');

    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      if (String(query).includes('display-mode: standalone')) {
        return {
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        };
      }
      return originalMatchMedia(query);
    };

    if ('Notification' in window) {
      try {
        Object.defineProperty(window.Notification, 'permission', {
          configurable: true,
          get: () => 'granted',
        });
      } catch {
        // ignore
      }
    }

    const fakeRegistration = {
      pushManager: {
        getSubscription: async () => (subscribed ? { unsubscribe: async () => true } : null),
        subscribe: async () => ({ toJSON: () => ({ endpoint: 'dev://push' }) }),
      },
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve(fakeRegistration),
        register: async () => fakeRegistration,
        getRegistration: async () => fakeRegistration,
      },
    });
  }, {
    storageKey: supabaseStorageKey(supabaseUrl),
    session: buildSession(),
    subscribed: pushSubscribed,
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function scrollInstallAndSaveBar(page) {
  await page.waitForSelector('[data-testid="install-app-installed"]');
  await page.waitForSelector('[data-testid="profile-sticky-save"]');
  await page.evaluate(() => {
    const install = document.querySelector('[data-testid="install-app-installed"]');
    const save = document.querySelector('[data-testid="profile-sticky-save"]');
    if (!install || !save) return;
    const installBottom = install.getBoundingClientRect().bottom + window.scrollY;
    const saveHeight = save.getBoundingClientRect().height;
    const target = installBottom - window.innerHeight + saveHeight + 24;
    window.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
  });
  await page.waitForTimeout(250);
}

/**
 * @param {import('playwright').Page} page
 */
async function scrollPushToggle(page) {
  await page.waitForSelector('[data-testid="push-notifications-toggle"]');
  await page.locator('[data-testid="push-notifications-toggle"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
}

/**
 * @param {import('playwright').Page} page
 * @param {'light' | 'dark'} theme
 */
async function applyTheme(page, theme) {
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, theme === 'dark');
  await page.waitForTimeout(150);
}

async function main() {
  const env = loadEnvLocal();
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';

  fs.mkdirSync(OUT, { recursive: true });

  const fullPageShots = [
    { width: 390, theme: 'light', file: 'perfil-full-390-light-bottom.png', pushOn: false },
    { width: 390, theme: 'dark', file: 'perfil-full-390-dark-bottom.png', pushOn: false },
    { width: 320, theme: 'light', file: 'perfil-full-320-light-push-on.png', pushOn: true },
    { width: 430, theme: 'light', file: 'perfil-full-430-light-push-on.png', pushOn: true },
  ];

  const browser = await chromium.launch();

  for (const shot of fullPageShots) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: 844 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await installSupabaseMocks(page, supabaseUrl, { pushSubscribed: shot.pushOn });
    await page.goto(`${BASE}/__dev/perfil`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=O Meu Perfil', { timeout: 15000 });

    await applyTheme(page, shot.theme);

    if (shot.pushOn) {
      await scrollPushToggle(page);
      const sw = page.getByRole('switch');
      if ((await sw.getAttribute('aria-checked')) !== 'true') {
        await sw.click();
        await page.waitForTimeout(400);
      }
    } else {
      await scrollInstallAndSaveBar(page);
    }

    await page.screenshot({ path: path.join(OUT, shot.file), fullPage: false });
    console.log('saved', shot.file);
    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
