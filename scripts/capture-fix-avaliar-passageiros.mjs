import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://127.0.0.1:4173/__dev/hotfix-prod-qa-acordos';
const OUT = '/opt/cursor/artifacts';

async function md5File(buf) {
  return createHash('md5').update(buf).digest('hex');
}

async function shot(page, name, selector, theme) {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }, theme === 'dark');
  const el = page.locator(selector);
  await el.scrollIntoViewIfNeeded();
  const buf = await el.screenshot();
  const file = path.join(OUT, `${name}-${theme}.png`);
  await writeFile(file, buf);
  const md5 = await md5File(buf);
  return { file, md5, theme };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await mkdir(OUT, { recursive: true });

const captures = [];
for (const theme of ['light', 'dark']) {
  captures.push(await shot(page, 'rating-mot-banner-2pax', '[data-testid="capture-rating-mot-2pax"]', theme));
  captures.push(await shot(page, 'sheet-fechar-foco', '[data-testid="capture-sheet-fechar-foco"]', theme));
  captures.push(await shot(page, 'disabled-pagamento-cta', '[data-testid="capture-disabled-pagamento-cta"]', theme));
}

await browser.close();
console.log(JSON.stringify(captures, null, 2));
