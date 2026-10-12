import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCaptureOutDir, resolveCaptureOutDir } from './captureOutDir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';
const OUT = resolveCaptureOutDir();
const WIDTHS = [390];

ensureCaptureOutDir(OUT);

const browser = await chromium.launch();

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/__dev/hub-passageiro-ux`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="hub-passageiro-ux-capture-root"]');

  await page.locator('[data-testid="hub-ux-h6a-edit-sheet"]').scrollIntoViewIfNeeded();

  const pickup = page.getByRole('combobox', { name: /Ponto de recolha \(opcional\)/i });
  await pickup.click();
  await pickup.fill('Talatona');
  await page.waitForFunction(
    () => {
      const listbox = document.querySelector('[role="listbox"]');
      if (listbox) {
        return listbox.querySelectorAll('[role="option"]').length > 0;
      }
      return document.querySelector('[data-testid="geocoder-network-error"]') != null;
    },
    { timeout: 15000 },
  );
  const hasSuggestions = await page.locator('[role="listbox"] [role="option"]').count();
  if (hasSuggestions === 0) {
    throw new Error('Captura abortada: sem sugestões Photon visíveis (verificar rede ou lang=pt).');
  }

  for (const theme of ['light', 'dark']) {
    await page.evaluate((isDark) => {
      document.documentElement.classList.toggle('dark', isDark);
    }, theme === 'dark');
    await page.waitForTimeout(250);
    const file = `hub-passageiro-ux-${width}-${theme}.png`;
    const outPath = path.join(OUT, file);
    await page.locator('[data-testid="hub-passageiro-ux-capture-root"]').screenshot({ path: outPath });
    const md5 = crypto.createHash('md5').update(fs.readFileSync(outPath)).digest('hex');
    console.log('saved', file, 'md5', md5);
  }

  await context.close();
}

await browser.close();
