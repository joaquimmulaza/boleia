import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  PROCURA_FORM_CLASS,
  PROCURA_FORM_BODY_CLASS,
  PROCURA_FORM_SUBMIT_FOOTER_CLASS,
} from './procuraFormLayout.js';

describe('procuraFormLayout', () => {
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
  const dashboardJsx = readFileSync(
    resolve(process.cwd(), 'src/pages/PassengerDashboard.jsx'),
    'utf8',
  );

  it('footer sticky colado ao fundo do main com fundo até à nav (pb-shell inset)', () => {
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).toMatch(/\bbottom-0\b/);
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).toMatch(/pb-\[var\(--shell-bottom-inset\)\]/);
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).not.toMatch(/bottom-\[var\(--shell-bottom-inset\)\]/);
    expect(indexCss).toMatch(/--procura-form-sticky-footer-reserve/);
    expect(dashboardJsx).toMatch(/PROCURA_FORM_SUBMIT_FOOTER_CLASS/);
  });

  it('corpo do form reserva altura do footer sticky', () => {
    expect(PROCURA_FORM_BODY_CLASS).toMatch(/pb-\[var\(--procura-form-sticky-footer-reserve\)\]/);
    expect(dashboardJsx).toMatch(/PROCURA_FORM_BODY_CLASS/);
  });

  it('form procura não define max-h nem scroll interno overflow-y-auto', () => {
    expect(PROCURA_FORM_CLASS).not.toMatch(/max-h-/);
    expect(PROCURA_FORM_CLASS).not.toMatch(/overflow-y-auto/);
    expect(dashboardJsx).not.toMatch(/procura-form-scroll/);
    expect(dashboardJsx).not.toMatch(/max-h-\[calc\(100dvh-10rem\)\]/);
  });
});
