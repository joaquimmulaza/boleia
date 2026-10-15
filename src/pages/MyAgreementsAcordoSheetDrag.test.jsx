import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';
import { resetOverlayStackForTests } from '../utils/overlayStack';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth(),
}));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForDriver: vi.fn(),
  getAgreementsForPassenger: vi.fn(),
  leavePassenger: vi.fn(),
  countLugaresVivosAcordo: vi.fn().mockResolvedValue(2),
  terminateAgreement: vi.fn(),
  rejectAgreementTermination: vi.fn(),
  listAdendaHistorico: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/offlineQueue', () => ({
  listPending: vi.fn().mockResolvedValue([]),
  drainQueue: vi.fn().mockResolvedValue({ processed: 0, remaining: 0, conflicts: [] }),
}));

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(() => ({ isOnline: true, isOffline: false })),
}));

vi.mock('../services/PaymentService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listPagamentosByAcordo: vi.fn().mockResolvedValue([]),
    getPagamentoForPassageiro: vi.fn().mockResolvedValue(null),
    getAcordoContactos: vi.fn().mockResolvedValue([]),
    getObrigacaoPagamentoPassageiro: vi.fn().mockResolvedValue(null),
    listAnulacaoMotivoLugarAcordos: vi.fn().mockResolvedValue([]),
    listPagamentosPendentesMotoristaAcordo: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../services/RatingService', () => ({
  listMinhasAvaliacoesAcordo: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import { getAgreementsForPassenger } from '../services/AgreementService';

const acordoPassageiro = {
  id: 'acordo-pax',
  estado: 'activo',
  driver_id: 'driver-1',
  n_passageiros_contrato: 1,
  valor_mensal_por_passageiro_kz: 50000,
  ofertas_capacidade: {
    origin_name: 'Viana',
    destination_name: 'Talatona',
    departure_time: '07:00',
  },
  acordos_passageiros: [
    { passenger_id: 'pax-viewer', estado: 'activo', quota_mensal_kz: 50000 },
  ],
};

function mockSheetMotion() {
  const hadAnimate = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'animate');
  const previousAnimate = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = function animate() {
    const anim = {
      onfinish: /** @type {null | (() => void)} */ (null),
      oncancel: /** @type {null | (() => void)} */ (null),
      playState: 'running',
      cancel() {
        this.playState = 'idle';
        this.oncancel?.();
      },
    };
    queueMicrotask(() => {
      if (anim.playState === 'idle') return;
      anim.playState = 'finished';
      anim.onfinish?.();
    });
    return /** @type {Animation} */ (/** @type {unknown} */ (anim));
  };
  return () => {
    if (hadAnimate) HTMLElement.prototype.animate = previousAnimate;
    else delete HTMLElement.prototype.animate;
  };
}

function dispatchDragDismiss(handle) {
  fireEvent.pointerDown(handle, { clientX: 40, clientY: 100, pointerId: 1, button: 0 });
  fireEvent.pointerMove(window, { clientX: 40, clientY: 320, pointerId: 1, button: 0 });
  fireEvent.pointerUp(window, { clientX: 40, clientY: 320, pointerId: 1, button: 0 });
}

describe('MyAgreements — FAIL 1 drag sheet detalhe acordo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
  });

  afterEach(() => {
    cleanup();
    resetOverlayStackForTests();
  });

  it('com scrollTop 0, arrastar o handle fecha o sheet', async () => {
    const restoreMotion = mockSheetMotion();
    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=acordo-pax']}>
        <MyAgreements />
      </MemoryRouter>,
    );

    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const handle = screen.getByTestId('sheet-drag-handle');
    dispatchDragDismiss(handle);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
    restoreMotion();
  });

  it('com scrollTop 0, arrastar o título do cabeçalho fecha o sheet', async () => {
    const restoreMotion = mockSheetMotion();
    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=acordo-pax']}>
        <MyAgreements />
      </MemoryRouter>,
    );

    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const titulo = screen.getByRole('heading', { name: /Detalhe do acordo/i });
    dispatchDragDismiss(titulo);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
    restoreMotion();
  });
});
