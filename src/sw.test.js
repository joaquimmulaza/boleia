import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const SW_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'sw.js'),
  'utf8',
);

describe('sw.js (PWA injectManifest)', () => {
  it('importa e invoca cleanupOutdatedCaches junto ao precache', () => {
    expect(SW_SOURCE).toMatch(/import\s*\{[^}]*cleanupOutdatedCaches[^}]*\}\s*from\s*'workbox-precaching'/);
    expect(SW_SOURCE).toMatch(/precacheAndRoute\(/);
    expect(SW_SOURCE.indexOf('cleanupOutdatedCaches()')).toBeGreaterThan(
      SW_SOURCE.indexOf('precacheAndRoute'),
    );
  });

  it('expõe build id via GET_BUILD_ID', () => {
    expect(SW_SOURCE).toMatch(/const APP_BUILD_ID = __APP_BUILD_ID__;/);
    expect(SW_SOURCE).toMatch(/type === 'GET_BUILD_ID'/);
    expect(SW_SOURCE).toMatch(/buildId: APP_BUILD_ID/);
  });
});
