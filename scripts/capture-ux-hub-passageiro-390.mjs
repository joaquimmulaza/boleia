import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCaptureOutDir, resolveCaptureOutDir } from './captureOutDir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';
const OUT = resolveCaptureOutDir();

ensureCaptureOutDir(OUT);

const files = {
  light: 'hub-passageiro-ux-390-light.png',
  dark: 'hub-passageiro-ux-390-dark.png',
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});

const page = await context.newPage();
await page.goto(`${BASE}/__dev/hub-passageiro-ux`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="hub-passageiro-ux-capture-root"]');

for (const [theme, file] of Object.entries(files)) {
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, theme === 'dark');
  await page.waitForTimeout(250);
  const outPath = path.join(OUT, file);
  await page.locator('[data-testid="hub-passageiro-ux-capture-root"]').screenshot({ path: outPath });
  const md5 = crypto.createHash('md5').update(fs.readFileSync(outPath)).digest('hex');
  console.log('saved', file, 'md5', md5);
}

const lightMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(OUT, files.light))).digest('hex');
const darkMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(OUT, files.dark))).digest('hex');
if (lightMd5 === darkMd5) {
  console.error('ERRO: screenshots light/dark têm o mesmo md5');
  process.exit(1);
}

await browser.close();
