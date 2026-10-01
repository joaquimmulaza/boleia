import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarketplaceExplore from './MarketplaceExplore';

const navigate = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ session: null, loading: false, tipoPerfil: null }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../services/OfertaService', () => ({
  listOfertasDisponiveis: vi.fn(),
  isOfertaFlexivel: (o) => Boolean(o?.flexibilidade_rota),
  labelOfertaRota: (o) => (o?.flexibilidade_rota ? 'Oferta flexível' : null),
}));

vi.mock('../services/ProcuraService', () => ({
  listProcurasDisponiveis: vi.fn(),
}));

vi.mock('../components/ThemeToggle', () => ({
  default: () => <button type="button">Tema</button>,
}));

import { listOfertasDisponiveis } from '../services/OfertaService';
import { listProcurasDisponiveis } from '../services/ProcuraService';

describe('MarketplaceExplore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-1',
        flexibilidade_rota: true,
        departure_time: '07:30',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 40000,
        modo_preco: 'POR_PASSAGEIRO',
      },
    ]);
    listProcurasDisponiveis.mockResolvedValue([
      {
        id: 'pr-1',
        origin_name: 'Talatona',
        destination_name: 'Miramar',
        preferred_time: '07:15',
        n_candidato: 1,
      },
    ]);
  });

  it('mostra ofertas públicas e CTA Entrar para propor → auth', async () => {
    render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('marketplace-explore')).toBeInTheDocument();
    expect(await screen.findByTestId('explore-oferta-card')).toBeInTheDocument();
    expect(screen.getByText(/Oferta flexível/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Entrar para propor/i }));
    expect(navigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');
  });

  it('tab Procuras lista procuras e CTA motorista', async () => {
    render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    await screen.findByTestId('explore-ofertas-feed');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras/i }));

    expect(await screen.findByTestId('explore-procura-card')).toBeInTheDocument();
    expect(screen.getByText('Talatona')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Entrar para propor/i }));
    expect(navigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });

  it('carrega listagens sem exigir sessão', async () => {
    render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listOfertasDisponiveis).toHaveBeenCalled();
      expect(listProcurasDisponiveis).toHaveBeenCalled();
    });
  });
});
