import { chromium } from 'playwright';
import { ensureCaptureOutDir, resolveCaptureOutDir } from './captureOutDir.js';

const OUT = resolveCaptureOutDir();
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';
const PATH = '/__dev/avaliar-passageiros-lista';

ensureCaptureOutDir(OUT);

const browser = await chromium.launch();
const page = await browser.newPage();

for (const mode of ['light', 'dark']) {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle' });
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, mode === 'dark');
  await page.waitForSelector('[data-testid="dev-avaliar-passageiros-lista-capture"]');
  await page.waitForSelector('[data-testid="avaliar-pax-row-p-exp"]:has-text("Prazo expirado")');
  await page.waitForSelector('[data-testid="avaliar-pax-row-p-feito"]:has-text("Avaliado")');
  const panel = page.locator('[data-testid="dev-avaliar-passageiros-lista-capture"]');
  await panel.screenshot({
    path: `${OUT}/avaliar-passageiros-lista-390-${mode}.png`,
  });
}

await browser.close();
console.log('OK', OUT);
