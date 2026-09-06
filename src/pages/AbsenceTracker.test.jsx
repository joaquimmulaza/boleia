import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AbsenceTracker from './AbsenceTracker';
import { expectNoUserFacingJargon } from '../test/jargonBan';

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

  it('mostra histórico de faltas no detalhe', async () => {
    render(<AbsenceTracker />);
    expect(await screen.findByText(/Histórico de Ausências/i)).toBeInTheDocument();
    expect(await screen.findByTestId('absence-card')).toBeInTheDocument();
  });

  it('bloqueia registo de falta sem pagamento em custódia', async () => {
    mockListPagamentosByAcordo.mockResolvedValue([
      { passenger_id: 'user-1', estado: 'pendente_pagamento' },
    ]);
    render(<AbsenceTracker />);
    expect(await screen.findByTestId('faltas-gate-pagamento')).toBeInTheDocument();
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
    expect(screen.getByText(/Acordo · 3 pessoas/i)).toBeInTheDocument();
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
    expect(await screen.findByText(/Registo de Faltas/i)).toBeInTheDocument();
    expectNoUserFacingJargon(document.body.textContent);
  });
});
