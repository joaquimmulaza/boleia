import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const OUT = '/opt/cursor/artifacts/screenshots/hotfix-prod-qa-acordos';
const BASE = 'http://127.0.0.1:5173/__dev/hotfix-prod-qa-acordos';

const captures = [
  { id: '1-motorista-encerrado', testId: 'capture-motorista-encerrado' },
  { id: '2-s3-justa-causa', testId: 'capture-s3-justa-causa' },
  { id: '3-reserva-alinhado', testId: 'capture-reserva-alinhado' },
  { id: '4-individual', testId: 'capture-individual' },
  { id: '5-reserva-iban-falta', testId: 'capture-reserva-iban-falta' },
];

async function md5(file) {
  const buf = await readFile(file);
  return createHash('md5').update(buf).digest('hex');
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

for (const theme of ['light', 'dark']) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (theme === 'dark') {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
  }
  for (const cap of captures) {
    const el = page.locator(`[data-testid="${cap.testId}"]`);
    await el.scrollIntoViewIfNeeded();
    const path = `${OUT}/${cap.id}-${theme}-390.png`;
    await el.screenshot({ path });
    const hash = await md5(path);
    console.log(`${path} md5=${hash}`);
  }
  await page.close();
}

await browser.close();
