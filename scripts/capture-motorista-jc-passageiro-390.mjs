import { chromium } from 'playwright';
import { ensureCaptureOutDir, resolveCaptureOutDir } from './captureOutDir.js';

const OUT = process.env.ARTIFACTS_DIR || resolveCaptureOutDir();
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';
const PATH_MOTORISTA = '/__dev/motorista-jc-passageiro';
const PATH_CONFIRM = '/__dev/justa-causa-confirm';

ensureCaptureOutDir(OUT);

const browser = await chromium.launch();
const page = await browser.newPage();

for (const mode of ['light', 'dark']) {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(`${BASE}${PATH_MOTORISTA}`, { waitUntil: 'networkidle' });
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, mode === 'dark');
  await page.waitForSelector('[data-testid="dev-motorista-jc-B"]');

  for (const variant of ['B', 'B2']) {
    const section = page.locator(`[data-testid="dev-motorista-jc-${variant}"]`);
    await section.screenshot({
      path: `${OUT}/motorista-jc-passageiro-${variant}-390-${mode}.png`,
    });
  }

  await page.goto(`${BASE}${PATH_CONFIRM}`, { waitUntil: 'networkidle' });
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, mode === 'dark');
  await page.waitForSelector('[data-testid="dev-jc-confirm-pax-parcial"]');

  for (const slug of ['pax-parcial', 'pax-ultimo', 'motorista']) {
    const section = page.locator(`[data-testid="dev-jc-confirm-${slug}"]`);
    await section.screenshot({
      path: `${OUT}/justa-causa-confirm-${slug}-390-${mode}.png`,
    });
  }
}

await browser.close();
console.log('OK', OUT);
