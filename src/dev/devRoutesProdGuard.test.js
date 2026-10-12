import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_PATH = path.resolve(import.meta.dirname, '../App.jsx');
const DEV_ROUTES_PATH = path.resolve(import.meta.dirname, 'DevAppRoutes.jsx');

describe('guard __dev — só disponível em import.meta.env.DEV (local vite)', () => {
  it('App.jsx: lazy DevAppRoutes e Route /__dev/* condicionados a DEV', () => {
    const src = fs.readFileSync(APP_PATH, 'utf8');
    expect(src).toMatch(/const LazyDevRoutes = import\.meta\.env\.DEV\s*\?\s*lazy/);
    expect(src).toMatch(/isDevPublicRoute = import\.meta\.env\.DEV && pathname\.startsWith\('\/__dev\/'\)/);
    expect(src).toMatch(/\{import\.meta\.env\.DEV && LazyDevRoutes \?/);
    expect(src).toMatch(/path="\/__dev\/\*"/);
  });

  it('DevAppRoutes.jsx: fallback Navigate / se import.meta.env.DEV for falso', () => {
    const src = fs.readFileSync(DEV_ROUTES_PATH, 'utf8');
    expect(src).toMatch(/if \(!import\.meta\.env\.DEV\)/);
    expect(src).toMatch(/<Navigate to="\/" replace \/>/);
  });

  it('App.jsx: rotas desconhecidas caem no fallback Navigate / (prod inclui /__dev/*)', () => {
    const src = fs.readFileSync(APP_PATH, 'utf8');
    expect(src).toMatch(/<Route path="\*" element=\{<Navigate to="\/" replace \/>\} \/>/);
  });
});
