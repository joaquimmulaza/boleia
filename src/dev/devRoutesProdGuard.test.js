import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_PATH = path.resolve(import.meta.dirname, '../App.jsx');
const DEV_ROUTES_PATH = path.resolve(import.meta.dirname, 'DevAppRoutes.jsx');
const ACCESS_PATH = path.resolve(import.meta.dirname, '../utils/devCaptureAccess.js');

describe('guard __dev — vite DEV + allowlist preview Vercel', () => {
  it('devCaptureAccess: prod aliases + padrão preview', () => {
    const src = fs.readFileSync(ACCESS_PATH, 'utf8');
    expect(src).toMatch(/DEV_CAPTURE_PROD_HOSTNAMES/);
    expect(src).toMatch(/boleia-cyan\.vercel\.app/);
    expect(src).toMatch(/boleia-joaquim-mulazas-projects\.vercel\.app/);
    expect(src).toMatch(/DEV_CAPTURE_PREVIEW_HOST_PATTERN/);
    expect(src).toMatch(/import\.meta\.env\.DEV/);
  });

  it('App.jsx: rota /__dev/* lazy; isDevCaptureRoutesEnabled', () => {
    const src = fs.readFileSync(APP_PATH, 'utf8');
    expect(src).toMatch(/lazy\(\(\) => import\('\.\/dev\/DevAppRoutes\.jsx'\)\)/);
    expect(src).toMatch(/isDevCaptureRoutesEnabled/);
    expect(src).toMatch(/path="\/__dev\/\*"/);
  });

  it('DevAppRoutes.jsx: Navigate / quando capturas desactivadas', () => {
    const src = fs.readFileSync(DEV_ROUTES_PATH, 'utf8');
    expect(src).toMatch(/isDevCaptureRoutesEnabled/);
    expect(src).toMatch(/<Navigate to="\/" replace \/>/);
  });
});
