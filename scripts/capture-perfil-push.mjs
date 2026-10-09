import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCaptureOutDir, resolveCaptureOutDir } from './captureOutDir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';
const OUT = resolveCaptureOutDir();
ensureCaptureOutDir(OUT);

const shots = [
  { theme: 'light', selector: '[data-testid="push-preview-off"]', file: 'perfil-push-390-light-off.png' },
  { theme: 'light', selector: '[data-testid="push-preview-on"]', file: 'perfil-push-390-light-on.png' },
  { theme: 'dark', selector: '[data-testid="push-preview-off"]', file: 'perfil-push-390-dark-off.png' },
  { theme: 'dark', selector: '[data-testid="push-preview-on"]', file: 'perfil-push-390-dark-on.png' },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});

const page = await context.newPage();
await page.goto(`${BASE}/__dev/perfil-push`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="push-preview-off"]');

for (const { theme, selector, file } of shots) {
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, theme === 'dark');
  await page.waitForTimeout(200);
  const el = page.locator(selector);
  await el.screenshot({ path: path.join(OUT, file) });
  console.log('saved', file);
}

await browser.close();
