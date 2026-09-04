import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PassengerDashboard from './PassengerDashboard';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'pax-1' }, tipoPerfil: 'Passageiro' }),
}));

vi.mock('../services/ProcuraService', () => ({
  createProcura: vi.fn(),
  listProcurasByOwner: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/MatchingService', () => ({
  findCompatibleOfertas: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
}));

vi.mock('../services/PropostaService', () => ({
  createProposta: vi.fn(),
}));

vi.mock('../services/WaitlistService', () => ({
  enqueueWaitlist: vi.fn(),
}));

vi.mock('../components/AddressInput', () => ({
  default: ({ name, label }) => (
    <label>
      {label}
      <input name={name} />
    </label>
  ),
}));

describe('PassengerDashboard — marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra empty state para criar procura', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('A minha procura')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Sem procura activa/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Criar procura/i })).toBeInTheDocument();
    });
  });
});
