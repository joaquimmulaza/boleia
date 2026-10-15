import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AbsenceTracker from './AbsenceTracker';
import { expectNoUserFacingJargon } from '../test/jargonBan';
import { formatFaltaMotoristaRepartidaConta } from '../copy/faltasMotoristaRepartidaConta';
const mockNavigate = vi.fn();
let mockAcordoId = 'acordo-uuid-001';

const FALTA_ONTEM = '2026-10-14';
const FALTA_HOJE_OUT_1 = '2026-10-01';
const MES_REF_OUT = '2026-10-01';

let mockAuth = {
  user: { id: 'user-1' },
  tipoPerfil: 'Passageiro',
  profileLoading: false,
};

const {
  mockGetAbsences,
  mockLogAbsence,
  mockGetAgreementsForDriver,
  mockGetAgreementsForPassenger,
  mockListPagamentosByAcordo,
  mockGetDescontoFaltasPreview,
} = vi.hoisted(() => ({
  mockGetAbsences: vi.fn(),
  mockLogAbsence: vi.fn(),
  mockGetAgreementsForDriver: vi.fn(),
  mockGetAgreementsForPassenger: vi.fn(),
  mockListPagamentosByAcordo: vi.fn(),
  mockGetDescontoFaltasPreview: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../services/AbsenceService', () => ({
  getAbsences: mockGetAbsences,
  logAbsence: mockLogAbsence,
}));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForDriver: mockGetAgreementsForDriver,
  getAgreementsForPassenger: mockGetAgreementsForPassenger,
}));

vi.mock('../services/PaymentService', () => ({
  listPagamentosByAcordo: mockListPagamentosByAcordo,
  getDescontoFaltasPreview: mockGetDescontoFaltasPreview,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => (mockAcordoId ? { acordoId: mockAcordoId } : {}),
  useNavigate: () => mockNavigate,
}));

vi.mock('../components/LogAbsenceModal', () => ({
  default: ({ isOpen, onSubmit, onClose }) =>
    isOpen ? (
      <div role="dialog">
        <button
          type="button"
          onClick={() =>
            onSubmit({
              dataFalta: FALTA_ONTEM,
              tipo: 'Passageiro',
              observacao: 'Consulta',
              viagem: 'ambas',
            })
          }
        >
          Confirmar falta
        </button>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
    ) : null,
}));

function useLuandaClock(isoDate) {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${isoDate}T12:00:00Z`));
}

describe('AbsenceTracker — marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLuandaClock('2026-10-15');
    mockAuth = {
      user: { id: 'user-1' },
      tipoPerfil: 'Passageiro',
      profileLoading: false,
    };
    mockAcordoId = 'acordo-uuid-001';
    mockListPagamentosByAcordo.mockResolvedValue([
      {
        id: 'pg-out',
        passenger_id: 'user-1',
        estado: 'em_custodia',
        mes_referencia: MES_REF_OUT,
        desconto_faltas_kz: 0,
      },
    ]);
    mockGetDescontoFaltasPreview.mockResolvedValue(1363.64);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f1',
        id_acordo: 'acordo-uuid-001',
        data_falta: FALTA_ONTEM,
        tipo: 'Passageiro',
        passenger_id: 'user-1',
        desconto_kz: 1363,
        viagem: 'ambas',
      },
    ]);
    mockGetAgreementsForPassenger.mockResolvedValue([
      {
        id: 'acordo-uuid-001',
        estado: 'activo',
        n_passageiros_contrato: 3,
        valor_mensal_por_passageiro_kz: 40000,
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mostra histórico de faltas no detalhe', async () => {
    render(<AbsenceTracker />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Registo de Faltas' })).toBeInTheDocument();
    expect(
      screen.queryByText('Registo de faltas disponível após pagamento validado em custódia.'),
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/Histórico de Ausências/i)).toBeInTheDocument();
    expect(await screen.findByTestId('absence-card')).toBeInTheDocument();
  });

  it('no dia 1 do mês em Luanda mostra falta registada nesse dia', async () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    mockGetDescontoFaltasPreview.mockResolvedValue(1363);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f1',
        id_acordo: 'acordo-uuid-001',
        data_falta: FALTA_HOJE_OUT_1,
        tipo: 'Passageiro',
        passenger_id: 'user-1',
        desconto_kz: 1363,
        viagem: 'ambas',
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findByTestId('absence-card')).toBeInTheDocument();
    expect(screen.getByTestId('desconto-falta-total')).toHaveTextContent('1363');
  });

  it('Total a descontar em custódia usa preview RPC (não soma cliente)', async () => {
    mockGetDescontoFaltasPreview.mockResolvedValue(1000);
    mockListPagamentosByAcordo.mockResolvedValue([
      {
        id: 'pg-cust',
        passenger_id: 'user-1',
        mes_referencia: '2026-10-01',
        estado: 'em_custodia',
      },
    ]);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f-set-cred-out',
        data_falta: '2026-09-08',
        desconto_mes_referencia: '2026-10-01',
        desconto_kz: 1000,
      },
      {
        id: 'f-extra',
        data_falta: '2026-10-02',
        desconto_kz: 800,
      },
    ]);

    render(<AbsenceTracker />);
    await waitFor(() => {
      expect(mockGetDescontoFaltasPreview).toHaveBeenCalledWith('pg-cust');
    });
    const totalBlock = screen.getByText(/Total a descontar/i).closest('div');
    expect(totalBlock).toHaveTextContent('1000');
  });

  it('Total a descontar liquidado usa desconto_faltas_kz', async () => {
    mockGetDescontoFaltasPreview.mockClear();
    mockListPagamentosByAcordo.mockResolvedValue([
      {
        id: 'pg-liq',
        passenger_id: 'user-1',
        mes_referencia: '2026-10-01',
        estado: 'liquidado',
        desconto_faltas_kz: 750,
      },
    ]);

    render(<AbsenceTracker />);
    await waitFor(() => {
      expect(screen.getByText(/Total a descontar/i)).toBeInTheDocument();
    });
    expect(mockGetDescontoFaltasPreview).not.toHaveBeenCalled();
    const totalBlock = screen.getByText(/Total a descontar/i).closest('div');
    expect(totalBlock).toHaveTextContent('750');
  });

  it('apresenta desconto com sinal coerente entre total e histórico', async () => {
    mockGetDescontoFaltasPreview.mockResolvedValue(1363);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f1',
        id_acordo: 'acordo-uuid-001',
        data_falta: FALTA_ONTEM,
        tipo: 'Passageiro',
        passenger_id: 'user-1',
        desconto_kz: 1363,
        viagem: 'ambas',
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findAllByText(/1363/)).toHaveLength(2);
    expect(screen.queryByText(/-1363/)).not.toBeInTheDocument();
    expect(screen.queryByText(/−1363/)).not.toBeInTheDocument();

    const total = screen.getByTestId('desconto-falta-total');
    const linha = screen.getByTestId('desconto-falta-amount');
    expect(total.className).toContain('tabular-nums');
    expect(linha.className).toContain('tabular-nums');
    expect(total.className).toContain('text-slate-900');
    expect(linha.className).toContain('text-slate-900');
    expect(linha.className).not.toMatch(/text-red/);
  });

  it('em custódia com desconto_faltas_kz 0 mostra soma das faltas (fixture 3d9b352b)', async () => {
    mockAcordoId = '3d9b352b-0000-0000-0000-000000000001';
    mockGetDescontoFaltasPreview.mockRejectedValue(new Error('preview indisponível'));
    mockListPagamentosByAcordo.mockResolvedValue([
      {
        id: 'pg-fixture',
        passenger_id: 'user-1',
        estado: 'em_custodia',
        mes_referencia: MES_REF_OUT,
        desconto_faltas_kz: 0,
      },
    ]);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f-future',
        id_acordo: mockAcordoId,
        data_falta: '2026-10-28',
        tipo: 'Passageiro',
        passenger_id: 'user-1',
        desconto_kz: 450,
        viagem: 'regresso',
      },
      {
        id: 'f-motorista',
        id_acordo: mockAcordoId,
        data_falta: '2026-10-14',
        tipo: 'Motorista',
        desconto_kz: 650,
        viagem: 'ambas',
      },
      {
        id: 'f-past',
        id_acordo: mockAcordoId,
        data_falta: '2026-10-08',
        tipo: 'Passageiro',
        passenger_id: 'user-1',
        desconto_kz: 900,
        viagem: 'ida',
      },
    ]);

    render(<AbsenceTracker />);

    expect(await screen.findAllByTestId('absence-card')).toHaveLength(3);
    expect(screen.getByTestId('desconto-falta-total')).toHaveTextContent('2000');
    expect(screen.getByTestId('falta-chip-prevista')).toHaveTextContent('Prevista');
  });

  it('pagamento liquidado mostra desconto_faltas_kz do servidor', async () => {
    mockListPagamentosByAcordo.mockResolvedValue([
      {
        passenger_id: 'user-1',
        estado: 'liquidado',
        mes_referencia: MES_REF_OUT,
        desconto_faltas_kz: 2000,
      },
    ]);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f1',
        id_acordo: 'acordo-uuid-001',
        data_falta: FALTA_ONTEM,
        tipo: 'Passageiro',
        passenger_id: 'user-1',
        desconto_kz: 500,
        viagem: 'ambas',
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findByTestId('desconto-falta-total')).toHaveTextContent('2000');
    expect(screen.queryByText('500')).not.toBeInTheDocument();
  });

  it('motorista: 3 passageiros activos, 1 falta Motorista 500 Kz — conta e total 1500 Kz', async () => {
    mockAuth = {
      user: { id: 'driver-1' },
      tipoPerfil: 'Motorista',
      profileLoading: false,
    };
    mockListPagamentosByAcordo.mockResolvedValue([
      {
        passenger_id: 'pax-1',
        estado: 'em_custodia',
        mes_referencia: MES_REF_OUT,
        desconto_faltas_kz: 0,
      },
      {
        passenger_id: 'pax-2',
        estado: 'em_custodia',
        mes_referencia: MES_REF_OUT,
        desconto_faltas_kz: 0,
      },
      {
        passenger_id: 'pax-3',
        estado: 'em_custodia',
        mes_referencia: MES_REF_OUT,
        desconto_faltas_kz: 0,
      },
    ]);
    mockGetAgreementsForDriver.mockResolvedValue([
      {
        id: 'acordo-uuid-001',
        estado: 'activo',
        acordos_passageiros: [
          { passenger_id: 'pax-1', estado: 'activo' },
          { passenger_id: 'pax-2', estado: 'activo' },
          { passenger_id: 'pax-3', estado: 'activo' },
        ],
      },
    ]);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f-mot',
        id_acordo: 'acordo-uuid-001',
        data_falta: FALTA_ONTEM,
        tipo: 'Motorista',
        desconto_kz: 500,
        viagem: 'ambas',
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findAllByTestId('absence-card')).toHaveLength(1);
    const totalEl = screen.getByTestId('desconto-falta-total');
    const contaEl = screen.getByTestId('falta-motorista-repartida-conta');
    expect(totalEl).toHaveTextContent('1500');
    expect(contaEl).toHaveTextContent(formatFaltaMotoristaRepartidaConta(3, 1500));
    expect(contaEl.textContent).toContain(totalEl.textContent.replace(/\s*Kz\s*$/, '').trim());
    expect(screen.getByTestId('desconto-falta-amount').textContent).toBe(totalEl.textContent);
  });

  it('motorista: 1 passageiro activo — copy singular e total alinhado', async () => {
    mockAuth = {
      user: { id: 'driver-1' },
      tipoPerfil: 'Motorista',
      profileLoading: false,
    };
    mockListPagamentosByAcordo.mockResolvedValue([
      {
        passenger_id: 'pax-1',
        estado: 'em_custodia',
        mes_referencia: MES_REF_OUT,
        desconto_faltas_kz: 0,
      },
    ]);
    mockGetAgreementsForDriver.mockResolvedValue([
      {
        id: 'acordo-uuid-001',
        estado: 'activo',
        acordos_passageiros: [{ passenger_id: 'pax-1', estado: 'activo' }],
      },
    ]);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f-mot',
        id_acordo: 'acordo-uuid-001',
        data_falta: FALTA_ONTEM,
        tipo: 'Motorista',
        desconto_kz: 500,
        viagem: 'ambas',
      },
    ]);
    render(<AbsenceTracker />);
    const totalEl = await screen.findByTestId('desconto-falta-total');
    const contaEl = screen.getByTestId('falta-motorista-repartida-conta');
    expect(totalEl).toHaveTextContent('500');
    expect(contaEl).toHaveTextContent(formatFaltaMotoristaRepartidaConta(1, 500));
    expect(contaEl.textContent).toContain(totalEl.textContent.replace(/\s*Kz\s*$/, '').trim());
    expect(contaEl.textContent).not.toContain('no total');
  });

  it('refetch pagamentos após registar falta', async () => {
    mockLogAbsence.mockResolvedValue({ id: 'f2' });
    render(<AbsenceTracker />);
    fireEvent.click(await screen.findByRole('button', { name: /Registar Falta/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar falta/i }));
    await waitFor(() => {
      expect(mockLogAbsence).toHaveBeenCalled();
      expect(mockGetAbsences).toHaveBeenCalledTimes(2);
      expect(mockListPagamentosByAcordo).toHaveBeenCalledTimes(2);
    });
  });

  it('desactiva Registar Falta enquanto o perfil carrega', async () => {
    mockAuth = {
      user: { id: 'user-1' },
      tipoPerfil: undefined,
      profileLoading: true,
    };
    render(<AbsenceTracker />);
    const btn = await screen.findByRole('button', { name: /Registar Falta/i });
    expect(btn).toBeDisabled();
  });

  it('mostra o vazio do mês sem faltas', async () => {
    mockGetAbsences.mockResolvedValue([]);
    render(<AbsenceTracker />);
    expect(await screen.findByText('Sem faltas este mês')).toBeInTheDocument();
    expect(screen.getByText('Não há faltas registadas neste acordo.')).toBeInTheDocument();
    expect(screen.queryByText(/divisores fixos/i)).not.toBeInTheDocument();
  });

  it('bloqueia registo de falta sem pagamento em custódia', async () => {
    mockListPagamentosByAcordo.mockResolvedValue([
      { passenger_id: 'user-1', estado: 'pendente_pagamento' },
    ]);
    render(<AbsenceTracker />);
    const titulo = await screen.findByRole('heading', {
      level: 1,
      name: 'Registo de faltas disponível após pagamento validado em custódia.',
    });
    expect(titulo).toHaveAttribute('data-testid', 'faltas-gate-pagamento');
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Registo de Faltas' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText('Registo de faltas disponível após pagamento validado em custódia.'),
    ).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Registar Falta/i })).not.toBeInTheDocument();
  });

  it('regista falta com viagem quando pagamento em custódia', async () => {
    mockLogAbsence.mockResolvedValue({ id: 'f2' });
    render(<AbsenceTracker />);
    fireEvent.click(await screen.findByRole('button', { name: /Registar Falta/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar falta/i }));
    await waitFor(() => {
      expect(mockLogAbsence).toHaveBeenCalledWith(
        expect.objectContaining({
          id_acordo: 'acordo-uuid-001',
          viagem: 'ambas',
          passenger_id: 'user-1',
        }),
      );
    });
  });

  it('hub lista acordos activos sem routes', async () => {
    mockAcordoId = null;
    mockGetAgreementsForPassenger.mockResolvedValue([
      {
        id: 'acordo-uuid-001',
        estado: 'activo',
        n_passageiros_contrato: 3,
        valor_mensal_por_passageiro_kz: 40000,
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findByTestId('acordo-faltas-item')).toBeInTheDocument();
    expect(screen.getByText('Acordo flexível · 3 pessoas')).toBeInTheDocument();
    expect(screen.queryByText('Origem')).not.toBeInTheDocument();
    expect(screen.queryByText('Destino')).not.toBeInTheDocument();
  });

  it('mostra a rota no cartão fixo e omite-a no flexível, independentemente de N', async () => {
    mockAcordoId = null;
    mockGetAgreementsForPassenger.mockResolvedValue([
      {
        id: 'flex-1',
        estado: 'activo',
        n_passageiros_contrato: 1,
        valor_mensal_por_passageiro_kz: 10000,
        ofertas_capacidade: { flexibilidade_rota: true, origin_name: null, destination_name: null },
      },
      {
        id: 'fixo-3',
        estado: 'activo',
        n_passageiros_contrato: 3,
        valor_mensal_por_passageiro_kz: 8000,
        ofertas_capacidade: {
          flexibilidade_rota: false,
          origin_name: 'Viana',
          destination_name: 'Talatona',
        },
      },
      {
        id: 'fixo-1',
        estado: 'activo',
        n_passageiros_contrato: 1,
        valor_mensal_por_passageiro_kz: 5000,
        ofertas_capacidade: {
          flexibilidade_rota: false,
          origin_name: 'Kilamba',
          destination_name: 'Mutamba',
        },
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findByText('Acordo flexível · 1 pessoa')).toBeInTheDocument();
    expect(screen.getByText('Acordo fixo · 3 pessoas')).toBeInTheDocument();
    expect(screen.getByText('Viana')).toBeInTheDocument();
    expect(screen.getByText('Talatona')).toBeInTheDocument();
    expect(screen.getByText('Kilamba')).toBeInTheDocument();
    expect(screen.getByText('Mutamba')).toBeInTheDocument();
    const flexCard = screen.getByText('Acordo flexível · 1 pessoa').closest('button');
    expect(flexCard).not.toHaveTextContent('Origem');
    expect(flexCard).not.toHaveTextContent('Destino');
  });

  it('preview RPC em erro: fallback cliente e registo activo', async () => {
    mockGetDescontoFaltasPreview.mockRejectedValue(new Error('RPC falhou'));
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f1',
        id_acordo: 'acordo-uuid-001',
        data_falta: FALTA_ONTEM,
        tipo: 'Passageiro',
        passenger_id: 'user-1',
        desconto_kz: 900,
        viagem: 'ambas',
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findByTestId('desconto-falta-total')).toHaveTextContent('900');
    expect(await screen.findByRole('button', { name: /Registar Falta/i })).toBeEnabled();
  });

  it('motorista com zero passageiros activos: total 0 e sem linha repartida', async () => {
    mockAuth = {
      user: { id: 'driver-1' },
      tipoPerfil: 'Motorista',
      profileLoading: false,
    };
    mockGetAgreementsForDriver.mockResolvedValue([
      {
        id: 'acordo-uuid-001',
        estado: 'activo',
        acordos_passageiros: [],
      },
    ]);
    mockListPagamentosByAcordo.mockResolvedValue([]);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f-mot',
        id_acordo: 'acordo-uuid-001',
        data_falta: FALTA_ONTEM,
        tipo: 'Motorista',
        desconto_kz: 500,
        viagem: 'ambas',
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findByTestId('desconto-falta-total')).toHaveTextContent('0');
    expect(screen.queryByTestId('falta-motorista-repartida-conta')).not.toBeInTheDocument();
  });

  it('não expõe jargon de produto na UI de faltas', async () => {
    mockAcordoId = null;
    mockGetAgreementsForPassenger.mockResolvedValue([
      {
        id: 'acordo-uuid-001',
        estado: 'activo',
        n_passageiros_contrato: 1,
        valor_mensal_por_passageiro_kz: 40000,
      },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findByRole('heading', { name: 'Faltas' })).toBeInTheDocument();
    expect(screen.queryByText(/divisores fixos/i)).not.toBeInTheDocument();
    expectNoUserFacingJargon(document.body.textContent);
  });
});
