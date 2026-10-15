import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DevAuthProvider from '../dev/DevAuthProvider';
import { DEV_PERFIL_CAPTURE_AUTH } from '../dev/devPerfilCaptureAuth';
import Layout from '../layouts/Layout';
import PageShell from '../components/PageShell';
import { ThemeProvider } from '../contexts/ThemeContext';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signOut: vi.fn() },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock('../components/NotificationBell', () => ({ default: () => null }));
vi.mock('../components/OnboardingPermissions', () => ({ default: () => null }));
vi.mock('../components/InstallAppPrompt', () => ({ default: () => null }));
vi.mock('../utils/pushSubscriptionLogout', () => ({
  removeCurrentDevicePushSubscription: vi.fn().mockResolvedValue({ success: true }),
}));
import {
  PROCURA_FORM_BODY_CLASS,
  PROCURA_FORM_CLASS,
  PROCURA_FORM_SUBMIT_FOOTER_CLASS,
} from './procuraFormLayout.js';

function ProcuraFormLayoutFixture() {
  return (
    <PageShell>
      <form data-testid="procura-form" className={PROCURA_FORM_CLASS}>
        <div className={PROCURA_FORM_BODY_CLASS} data-testid="procura-form-body">
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i} className="text-sm text-slate-500">
              Bloco de conteúdo {i + 1} — simula form longo em Editar procura.
            </p>
          ))}
          <div className="flex flex-wrap gap-2" aria-label="Dias da semana">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => (
              <span
                key={label}
                className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-light-gray px-2.5 text-sm font-bold dark:bg-slate-800"
              >
                {label}
              </span>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Teto mensal por passageiro (Kz)</span>
            <input type="number" aria-label="Teto mensal por passageiro" className="h-12 rounded-lg" />
            <p className="text-xs text-slate-500" data-testid="teto-help-text">
              Valor máximo que queres pagar pela tua quota mensal.
            </p>
          </label>
        </div>
        <div data-testid="procura-form-submit-footer" className={PROCURA_FORM_SUBMIT_FOOTER_CLASS}>
          <button type="button" className="w-full rounded-xl bg-primary py-4 font-bold text-white">
            Guardar alterações
          </button>
        </div>
      </form>
    </PageShell>
  );
}

describe('procuraFormLayout — Layout autenticado', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
  });

  it('com scroll no fim, help text do teto fica acima do footer sticky (não tapado)', () => {
    render(
      <ThemeProvider>
        <div className="flex h-[844px] max-h-[844px] flex-col overflow-hidden">
          <DevAuthProvider value={DEV_PERFIL_CAPTURE_AUTH}>
            <MemoryRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<ProcuraFormLayoutFixture />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </DevAuthProvider>
        </div>
      </ThemeProvider>,
    );

    const main = document.querySelector('main');
    expect(main).toBeTruthy();
    main.scrollTop = main.scrollHeight;

    const help = screen.getByTestId('teto-help-text');
    const footer = screen.getByTestId('procura-form-submit-footer');
    const helpRect = help.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const nav = document.querySelector('nav[aria-label="Navegação principal"]');
    const navRect = nav?.getBoundingClientRect();

    expect(helpRect.bottom).toBeLessThanOrEqual(footerRect.top + 1);
    expect(footerRect.bottom).toBeLessThanOrEqual((navRect?.top ?? 844) + 2);
    expect(footer.className).toMatch(/pb-\[var\(--shell-bottom-inset\)\]/);
  });
});
