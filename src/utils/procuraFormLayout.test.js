import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  PROCURA_FORM_CLASS,
  PROCURA_FORM_BODY_CLASS,
  PROCURA_FORM_SUBMIT_FOOTER_CLASS,
  PROCURA_FORM_SUBMIT_FOOTER_STANDALONE_SAFE_CLASS,
} from './procuraFormLayout.js';

describe('procuraFormLayout — contrato B1 (#293 follow-up)', () => {
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
  const layoutJsx = readFileSync(resolve(process.cwd(), 'src/layouts/Layout.jsx'), 'utf8');
  const dashboardJsx = readFileSync(
    resolve(process.cwd(), 'src/pages/PassengerDashboard.jsx'),
    'utf8',
  );
  const devCaptureJsx = readFileSync(
    resolve(process.cwd(), 'src/pages/DevGeocoderEditarProcuraCapture.jsx'),
    'utf8',
  );

  it('corpo do form sem reserva extra (main pb-shell + sticky bastam)', () => {
    expect(PROCURA_FORM_BODY_CLASS).toBe('space-y-4 p-5');
    expect(PROCURA_FORM_BODY_CLASS).not.toMatch(/procura-form-sticky-footer-reserve/);
    expect(indexCss).not.toMatch(/--procura-form-sticky-footer-reserve/);
    expect(indexCss).not.toMatch(/--procura-form-footer-action-height/);
  });

  it('PageShell sem pb-24 extra quando view === form (evita banda acima da nav)', () => {
    expect(dashboardJsx).toMatch(/<PageShell className=\{view === 'form' \? 'pb-0' : undefined\}>/);
  });

  it('footer form-view: bottom-0, pb-3, sem shell inset nem -mb (falha em 32974f5)', () => {
    expect(layoutJsx).toMatch(/pb-shell/);
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).toMatch(/\bbottom-0\b/);
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).toMatch(/\bpb-3\b/);
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).not.toMatch(/pb-\[var\(--shell-bottom-inset\)\]/);
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).not.toMatch(/-mb-\[var\(--shell-bottom-inset\)\]/);
    expect(PROCURA_FORM_SUBMIT_FOOTER_CLASS).not.toMatch(/bottom-\[var\(--shell-bottom-inset\)\]/);
    expect(dashboardJsx).toMatch(/PROCURA_FORM_SUBMIT_FOOTER_CLASS/);
  });

  it('captura DEV sem bottom nav usa pb-safe no footer', () => {
    expect(PROCURA_FORM_SUBMIT_FOOTER_STANDALONE_SAFE_CLASS).toBe('pb-safe');
    expect(devCaptureJsx).toMatch(/PROCURA_FORM_SUBMIT_FOOTER_STANDALONE_SAFE_CLASS/);
  });

  it('form procura não define max-h nem scroll interno overflow-y-auto', () => {
    expect(PROCURA_FORM_CLASS).not.toMatch(/max-h-/);
    expect(PROCURA_FORM_CLASS).not.toMatch(/overflow-y-auto/);
    expect(dashboardJsx).not.toMatch(/procura-form-scroll/);
    expect(dashboardJsx).not.toMatch(/max-h-\[calc\(100dvh-10rem\)\]/);
  });
});
