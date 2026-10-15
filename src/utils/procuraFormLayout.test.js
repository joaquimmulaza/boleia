import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  PROCURA_FORM_CLASS,
  PROCURA_FORM_SUBMIT_FOOTER_CLASS,
} from './procuraFormLayout.js';

describe('procuraFormLayout', () => {
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
  const dashboardJsx = readFileSync(
    resolve(process.cwd(), 'src/pages/PassengerDashboard.jsx'),
    'utf8',
  );

  it('footer sticky usa o mesmo inset que pb-shell / bottom nav', () => {
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).toMatch(
      /bottom-\[var\(--shell-bottom-inset\)\]/,
    );
    expect(indexCss).toMatch(
      /--shell-bottom-inset:\s*calc\(var\(--bottom-nav-height\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/,
    );
    expect(indexCss).toMatch(/--bottom-nav-height:\s*4rem/);
    expect(dashboardJsx).toMatch(/PROCURA_FORM_SUBMIT_FOOTER_CLASS/);
  });

  it('form procura não define max-h nem scroll interno overflow-y-auto', () => {
    expect(PROCURA_FORM_CLASS).not.toMatch(/max-h-/);
    expect(PROCURA_FORM_CLASS).not.toMatch(/overflow-y-auto/);
    expect(dashboardJsx).not.toMatch(/procura-form-scroll/);
    expect(dashboardJsx).not.toMatch(/max-h-\[calc\(100dvh-10rem\)\]/);
  });
});
