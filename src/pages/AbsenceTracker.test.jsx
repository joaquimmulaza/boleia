import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AbsenceTracker from './AbsenceTracker';
import { expectNoUserFacingJargon } from '../test/jargonBan';
import * as faltasDisplay from '../utils/faltasDisplay';

const mockNavigate = vi.fn();
let mockAcordoId = 'acordo-uuid-001';

const {
  mockGetAbsences,
  mockLogAbsence,
  mockGetAgreementsForDriver,
  mockGetAgreementsForPassenger,
  mockListPagamentosByAcordo,
} = vi.hoisted(() => ({
  mockGetAbsences: vi.fn(),
  mockLogAbsence: vi.fn(),
  mockGetAgreementsForDriver: vi.fn(),
  mockGetAgreementsForPassenger: vi.fn(),
  mockListPagamentosByAcordo: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    tipoPerfil: 'Passageiro',
  }),
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
              dataFalta: '2026-09-04',
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

describe('AbsenceTracker — marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(faltasDisplay, 'filterFaltasEsteMes').mockImplementation((faltas) => faltas || []);
    mockAcordoId = 'acordo-uuid-001';
    mockListPagamentosByAcordo.mockResolvedValue([
      { passenger_id: 'user-1', estado: 'em_custodia' },
    ]);
    mockGetAbsences.mockResolvedValue([
      {
        id: 'f1',
        id_acordo: 'acordo-uuid-001',
        data_falta: '2026-09-01',
        tipo: 'Passageiro',
        desconto_kz: 1363.64,
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

  it('apresenta desconto com sinal coerente entre total e histórico', async () => {
    render(<AbsenceTracker />);
    expect(await screen.findAllByText(/1363,64/)).toHaveLength(2);
    expect(screen.queryByText(/-1363,64/)).not.toBeInTheDocument();
  });

  it('usa filtro «Este mês» no total e no histórico', async () => {
    vi.spyOn(faltasDisplay, 'filterFaltasEsteMes').mockImplementation((faltas) =>
      (faltas || []).filter((f) => f.data_falta !== '2026-10-15'),
    );

    mockGetAbsences.mockResolvedValue([
      {
        id: 'f-future',
        id_acordo: 'acordo-uuid-001',
        data_falta: '2026-10-15',
        tipo: 'Motorista',
        desconto_kz: 1272.73,
        viagem: 'ambas',
      },
      {
        id: 'f-today',
        id_acordo: 'acordo-uuid-001',
        data_falta: '2026-10-01',
        tipo: 'Passageiro',
        desconto_kz: 500,
        viagem: 'ambas',
      },
    ]);

    render(<AbsenceTracker />);

    expect(await screen.findByTestId('absence-card')).toBeInTheDocument();
    expect(faltasDisplay.filterFaltasEsteMes).toHaveBeenCalled();
    expect(screen.getAllByTestId('absence-card')).toHaveLength(1);
    expect(screen.queryByText('1272,73')).not.toBeInTheDocument();
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
