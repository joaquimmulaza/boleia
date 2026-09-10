import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('Layout shell — bottom nav vs modais (ENG#28)', () => {
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
  const layoutJsx = readFileSync(resolve(process.cwd(), 'src/layouts/Layout.jsx'), 'utf8');

  it('z-modal fica acima de z-bottom-nav', () => {
    const modalMatch = indexCss.match(/--z-modal:\s*(\d+)/);
    const navMatch = indexCss.match(/--z-bottom-nav:\s*(\d+)/);
    expect(Number(modalMatch?.[1])).toBeGreaterThan(Number(navMatch?.[1]));
  });

  it('define safe-area e inset shell para conteúdo principal', () => {
    expect(indexCss).toMatch(/\.pb-safe/);
    expect(indexCss).toMatch(/\.pb-shell/);
    expect(indexCss).toMatch(/--shell-bottom-inset/);
    expect(layoutJsx).toMatch(/pb-shell/);
    expect(layoutJsx).toMatch(/z-bottom-nav/);
  });
});
