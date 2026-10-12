#!/usr/bin/env node
/**
 * Captura 390px — piloto reservado (light + dark) via /__dev/acordos-chips
 */
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:5173';
const OUT = process.env.ARTIFACTS_DIR || '/opt/cursor/artifacts';

function md5(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex');
}

async function capture(page, dark, filename) {
  await page.goto(`${BASE}/__dev/acordos-chips`, { waitUntil: 'networkidle' });
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, dark);
  const panel = page.locator('[data-testid="dev-piloto-reservado-capture"]');
  await panel.waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 390, height: 720 });
  await panel.screenshot({ path: `${OUT}/${filename}` });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const light = 'ux-piloto-reservado-light-390.png';
  const dark = 'ux-piloto-reservado-dark-390.png';
  await capture(page, false, light);
  await capture(page, true, dark);
  await browser.close();
  console.log('light md5', md5(`${OUT}/${light}`));
  console.log('dark md5', md5(`${OUT}/${dark}`));
  console.log('saved', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
