import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_PATH = path.resolve(import.meta.dirname, '../App.jsx');
const DEV_ROUTES_PATH = path.resolve(import.meta.dirname, 'DevAppRoutes.jsx');
const ACCESS_PATH = path.resolve(import.meta.dirname, '../utils/devCaptureAccess.js');

describe('guard __dev — preview permitido, produção (hostname) bloqueada', () => {
  it('devCaptureAccess: prod host boleia-cyan.vercel.app', () => {
    const src = fs.readFileSync(ACCESS_PATH, 'utf8');
    expect(src).toMatch(/DEV_CAPTURE_PROD_HOSTNAME = 'boleia-cyan\.vercel\.app'/);
    expect(src).toMatch(/isDevCaptureRoutesEnabled/);
  });

  it('App.jsx: rota /__dev/* sempre registada; acesso via devCaptureAccess', () => {
    const src = fs.readFileSync(APP_PATH, 'utf8');
    expect(src).toMatch(/lazy\(\(\) => import\('\.\/dev\/DevAppRoutes\.jsx'\)\)/);
    expect(src).toMatch(/isDevCaptureRoutesEnabled/);
    expect(src).toMatch(/path="\/__dev\/\*"/);
    expect(src).not.toMatch(/\{import\.meta\.env\.DEV && LazyDevRoutes/);
  });

  it('DevAppRoutes.jsx: Navigate / quando capturas desactivadas', () => {
    const src = fs.readFileSync(DEV_ROUTES_PATH, 'utf8');
    expect(src).toMatch(/isDevCaptureRoutesEnabled/);
    expect(src).toMatch(/<Navigate to="\/" replace \/>/);
    expect(src).not.toMatch(/if \(!import\.meta\.env\.DEV\)/);
  });

  it('App.jsx: rotas desconhecidas caem no fallback Navigate /', () => {
    const src = fs.readFileSync(APP_PATH, 'utf8');
    expect(src).toMatch(/<Route path="\*" element=\{<Navigate to="\/" replace \/>\} \/>/);
  });
});
