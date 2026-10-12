import { chromium } from 'playwright';
import { ensureCaptureOutDir, resolveCaptureOutDir } from './captureOutDir.js';

const OUT = process.env.ARTIFACTS_DIR || resolveCaptureOutDir();
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';
const PATH = '/__dev/pagamento-panel';

ensureCaptureOutDir(OUT);

const browser = await chromium.launch();
const page = await browser.newPage();

for (const mode of ['light', 'dark']) {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle' });
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, mode === 'dark');
  await page.waitForSelector('[data-testid="acordo-pagamento-panel"]');
  await page.waitForSelector('[data-testid="acordo-pagamento-panel"]:has-text("IBAN da plataforma")');
  const panel = page.locator('[data-testid="acordo-pagamento-panel"]');
  await panel.screenshot({
    path: `${OUT}/pagamento-panel-390-${mode}.png`,
  });
}

await browser.close();
console.log('OK', OUT);
