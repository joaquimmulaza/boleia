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

  it('mostra ofertas públicas; o CTA pede acordo e o toque não navega', async () => {
    render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('marketplace-explore')).toBeInTheDocument();
    expect(await screen.findByTestId('explore-oferta-card')).toBeInTheDocument();
    expect(screen.getByText(/Oferta flexível/i)).toBeInTheDocument();
    expect(screen.getByText('Disponível para acordos')).toBeInTheDocument();
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Disponível para acordos'));
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Propor acordo' }));
    expect(navigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');
  });

  it('tab Procuras lista procuras e CTA Enviar proposta', async () => {
    render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    await screen.findByTestId('explore-ofertas-feed');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras/i }));

    expect(await screen.findByTestId('explore-procura-card')).toBeInTheDocument();
    expect(screen.getByText('Talatona')).toBeInTheDocument();
    expect(screen.getByTestId('route-indicator')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Talatona'));
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar proposta' }));
    expect(navigate).toHaveBeenCalledWith('/auth?mode=register&role=driver');
  });

  it('omitte ofertas canceladas ou expiradas e mostra erro com nova tentativa', async () => {
    listOfertasDisponiveis.mockResolvedValueOnce([
      {
        id: 'of-viva',
        flexibilidade_rota: false,
        origin_name: 'Viana',
        destination_name: 'Talatona',
        estado: 'disponivel',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 10000,
        modo_preco: 'POR_PASSAGEIRO',
      },
      {
        id: 'of-morta',
        flexibilidade_rota: false,
        origin_name: 'Kilamba',
        destination_name: 'Maianga',
        estado: 'expirada',
        vagas_disponiveis: 1,
        valor_mensal_ask_kz: 5000,
        modo_preco: 'POR_PASSAGEIRO',
      },
    ]);

    const { unmount } = render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Viana')).toBeInTheDocument();
    expect(screen.queryByText('Kilamba')).not.toBeInTheDocument();
    expect(screen.queryByText(/expirada/i)).not.toBeInTheDocument();
    unmount();

    listOfertasDisponiveis.mockRejectedValueOnce(new Error('rede'));
    render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as oportunidades');
    listOfertasDisponiveis.mockResolvedValueOnce([]);
    listProcurasDisponiveis.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Ainda não há ofertas publicadas.')).toBeInTheDocument();
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
