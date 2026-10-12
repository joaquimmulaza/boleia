import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PREVIEW_PORT = 4173 + (process.pid % 50);
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

/** @type {import('node:child_process').ChildProcess | null} */
let previewProcess = null;

describe('build produção: /__dev/* inacessível (bundle + preview)', () => {
  beforeAll(() => {
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe', env: { ...process.env, NODE_ENV: 'production' } });
    try {
      execSync(`fuser -k ${PREVIEW_PORT}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
    } catch {
      /* noop */
    }
    previewProcess = spawn(
      'npx',
      ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)],
      { cwd: ROOT, stdio: 'ignore', detached: false },
    );
    execSync(
      `bash -c 'for i in $(seq 1 30); do curl -sf ${PREVIEW_URL}/ >/dev/null && exit 0; sleep 1; done; exit 1'`,
      { stdio: 'pipe' },
    );
  }, 180_000);

  afterAll(() => {
    if (previewProcess && !previewProcess.killed) {
      previewProcess.kill('SIGTERM');
    }
  });

  it('entry prod não regista paths __dev (lazy chunk pode existir mas não monta)', () => {
    const distDir = path.join(ROOT, 'dist');
    const files = fs.readdirSync(distDir, { recursive: true });
    const jsFiles = files.filter((f) => String(f).endsWith('.js'));
    let allJs = '';
    let entryBundle = '';
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(distDir, String(file)), 'utf8');
      allJs += content;
      if (/^assets\/index-.*\.js$/.test(String(file))) {
        entryBundle = content;
      }
    }
    expect(entryBundle).not.toMatch(/path="\/__dev\/\*"/);
    expect(allJs).not.toMatch(/__dev\/notif-cards-269/);
    expect(allJs).not.toMatch(/__dev\/acordos-chips/);
  });

  it('preview prod: /__dev/notif-cards-269 redirecciona para / (captura não monta)', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${PREVIEW_URL}/__dev/notif-cards-269`, { waitUntil: 'networkidle' });
    await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
    expect(await page.locator('[data-testid="dev-notif-cards-269-capture"]').count()).toBe(0);
    expect(await page.getByText(/A boleia que faz sentido/i).isVisible()).toBe(true);
    await browser.close();
  }, 60_000);
});
