import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
}));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForDriver: vi.fn().mockResolvedValue([
    {
      id: 'acordo-1',
      estado: 'activo',
      n_passageiros_contrato: 3,
      valor_mensal_por_passageiro_kz: 40000,
      valor_mensal_total_kz: 120000,
      is_hidden_by_user: false,
      acordos_passageiros: [],
    },
  ]),
  getAgreementsForPassenger: vi.fn().mockResolvedValue([]),
  leavePassenger: vi.fn(),
}));

describe('MyAgreements — marketplace 1:N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista acordos activos com copy humana', async () => {
    render(
      <MemoryRouter>
        <MyAgreements />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Acordos')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Grupo · 3 pessoas/i)).toBeInTheDocument();
      expect(screen.getByText(/Kz \/ pessoa/i)).toBeInTheDocument();
    });
  });
});
