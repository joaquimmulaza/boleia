import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DriverDashboard from './DriverDashboard';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
}));

vi.mock('../services/OfertaService', () => ({
  listOfertasByDriver: vi.fn().mockResolvedValue([
    {
      id: 'of-1',
      origin_name: 'Talatona',
      destination_name: 'Mutual',
      departure_time: '07:15',
      vagas_disponiveis: 3,
      modo_preco: 'TOTAL_ACORDO',
      valor_mensal_ask_kz: 120000,
      estado: 'parcial',
    },
  ]),
}));

vi.mock('../services/PropostaService', () => ({
  listPropostasByOferta: vi.fn().mockResolvedValue([]),
  rejectProposta: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      })),
    })),
  },
}));

describe('DriverDashboard — marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra ofertas do motorista com copy humana', async () => {
    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('As minhas ofertas')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Talatona')).toBeInTheDocument();
      expect(screen.getByText('Mutual')).toBeInTheDocument();
      expect(screen.getByText(/3 lugares disponíveis/i)).toBeInTheDocument();
      expect(screen.getByText(/Total do acordo/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Publicar oferta/i })).toBeInTheDocument();
  });
});
