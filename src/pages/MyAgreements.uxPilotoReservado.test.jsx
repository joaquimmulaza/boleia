import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForDriver: vi.fn(),
  getAgreementsForPassenger: vi.fn(),
  leavePassenger: vi.fn(),
  renegotiateAgreementPricing: vi.fn(),
  acceptAgreementAdenda: vi.fn(),
  rejectAgreementAdenda: vi.fn(),
  rejectAgreementTermination: vi.fn(),
  terminateAgreement: vi.fn(),
  countLugaresVivosAcordo: vi.fn(),
  listAnulacaoMotivoLugarAcordos: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/PaymentService', () => ({
  listPagamentosByAcordo: vi.fn().mockResolvedValue([]),
  getObrigacaoPagamentoPassageiro: vi.fn(),
  getAcordoContactos: vi.fn(),
}));

vi.mock('../services/RatingService', () => ({
  listRatingPromptsForAcordo: vi.fn().mockResolvedValue([]),
}));

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock('../hooks/usePendingLeaveIds', () => ({
  usePendingLeaveIds: () => ({ pendingLeaveIds: {}, refreshPendingLeaveIds: vi.fn() }),
}));

const { useAuth } = await import('../contexts/AuthContext');
const { getAgreementsForDriver, getAgreementsForPassenger } = await import('../services/AgreementService');
const { getObrigacaoPagamentoPassageiro } = await import('../services/PaymentService');

const oferta = {
  origin_name: 'Talatona',
  destination_name: 'Mutual',
  departure_time: '07:15',
};

function acordoBase(linhas) {
  return {
    id: 'acordo-piloto',
    estado: 'activo',
    modo_preco: 'POR_PASSAGEIRO',
    n_passageiros_contrato: linhas.length,
    valor_mensal_por_passageiro_kz: 40000,
    valor_mensal_total_kz: 40000 * linhas.length,
    is_hidden_by_user: false,
    ofertas_capacidade: oferta,
    acordos_passageiros: linhas,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/acordos']}>
      <MyAgreements />
    </MemoryRouter>,
  );
}

/** @param {HTMLElement} root */
function estadoChipLista(root) {
  const chips = root.querySelectorAll('.rounded-full');
  return Array.from(chips).find((el) =>
    /^(Activo|Reservado|Encerramento|Cancelamento|Termina)/i.test(el.textContent || ''),
  );
}

describe('MyAgreements — UX piloto reservado (lista)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForPassenger.mockResolvedValue([]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      obrigacao: { valor: 0, valor_em_divida: 0, quota: 40000 },
      pagamento: null,
    });
  });

  it('só reservado: chip Reservado e sem linha Grupo (0 activos — nunca «0 pessoas»)', async () => {
    getAgreementsForDriver.mockResolvedValue([
      acordoBase([
        {
          id: 'ap-1',
          passenger_id: 'p1',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Ana Reserva' },
        },
        {
          id: 'ap-2',
          passenger_id: 'p2',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'João Reserva' },
        },
      ]),
    ]);

    renderPage();

    const card = await screen.findByRole('button', { name: /Talatona/i });
    const chip = estadoChipLista(card);
    expect(chip).toBeTruthy();
    expect(chip).toHaveTextContent('Reservado');
    expect(chip).not.toHaveTextContent('Activo');
    expect(within(card).queryByText(/Grupo ·/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/0 pessoas/i)).not.toBeInTheDocument();
    expect(within(card).getByTestId('acordo-grupo-linha-acordo-piloto')).toBeInTheDocument();
    expect(within(card).getByTestId('acordo-grupo-linha-acordo-piloto').textContent?.trim()).toBe('');
  });

  it('misto: chip Activo e Grupo · 1', async () => {
    getAgreementsForDriver.mockResolvedValue([
      acordoBase([
        {
          id: 'ap-1',
          passenger_id: 'p1',
          estado: 'activo',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Ana Activa' },
        },
        {
          id: 'ap-2',
          passenger_id: 'p2',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'João Reserva' },
        },
      ]),
    ]);

    renderPage();

    const card = await screen.findByRole('button', { name: /Talatona/i });
    expect(estadoChipLista(card)).toHaveTextContent('Activo');
    expect(within(card).getByText(/Ana/i)).toBeInTheDocument();
  });

  it('misto com reservado primeiro na lista: cartão N=1 mostra o activo, não o reservado', async () => {
    getAgreementsForDriver.mockResolvedValue([
      acordoBase([
        {
          id: 'ap-2',
          passenger_id: 'p2',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'João Reserva' },
        },
        {
          id: 'ap-1',
          passenger_id: 'p1',
          estado: 'activo',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Ana Activa' },
        },
      ]),
    ]);

    renderPage();

    const card = await screen.findByRole('button', { name: /Talatona/i });
    expect(estadoChipLista(card)).toHaveTextContent('Activo');
    expect(within(card).getByText(/Ana/i)).toBeInTheDocument();
    expect(within(card).queryByText(/João/i)).not.toBeInTheDocument();
  });

  it('só activo: chip Activo e Grupo · 2', async () => {
    getAgreementsForDriver.mockResolvedValue([
      acordoBase([
        {
          id: 'ap-1',
          passenger_id: 'p1',
          estado: 'activo',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Ana Activa' },
        },
        {
          id: 'ap-2',
          passenger_id: 'p2',
          estado: 'activo',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'João Activo' },
        },
      ]),
    ]);

    renderPage();

    const card = await screen.findByRole('button', { name: /Talatona/i });
    expect(estadoChipLista(card)).toHaveTextContent('Activo');
    await waitFor(() => {
      expect(within(card).getByText(/Grupo · 2 pessoas/i)).toBeInTheDocument();
    });
  });
});
