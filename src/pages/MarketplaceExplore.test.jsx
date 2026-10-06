import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

  it('anónimo: o corpo abre o detalhe e o CTA «Propor acordo» vai para /auth', async () => {
    render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('opportunity-open'));
    expect(screen.getByTestId('opportunity-detail-sheet')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByTestId('opportunity-detail-sheet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Propor acordo' }));
    expect(navigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');
    expect(screen.queryByTestId('opportunity-detail-sheet')).not.toBeInTheDocument();
  });

  it('mostra ofertas públicas; o CTA pede acordo e o toque não navega', async () => {
    render(
      <MemoryRouter>
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('marketplace-explore')).toBeInTheDocument();
    const lockup = screen.getByTestId('brand-lockup');
    expect(lockup.querySelector('img')).toHaveAttribute('src', '/boleia-logo.png');
    expect(lockup.querySelector('img')).toHaveAttribute('alt', 'Boleia Certa');
    expect(lockup).not.toHaveTextContent('Boleia Certa');
    expect(screen.getByRole('button', { name: 'Boleia Certa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Propor acordo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entrar para propor/i })).not.toBeInTheDocument();
    expect(await screen.findByTestId('explore-oferta-card')).toBeInTheDocument();
    expect(screen.getByText(/Oferta flexível/i)).toBeInTheDocument();
    expect(screen.getByText('Disponível para acordos')).toBeInTheDocument();
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Disponível para acordos'));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('opportunity-detail-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
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
    expect(screen.getByTestId('opportunity-detail-sheet')).toBeInTheDocument();
    expect(screen.getAllByTestId('route-indicator').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
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

  it('modo filtrado: título, chip, exclui flexível e vazio com CTAs', async () => {
    listOfertasDisponiveis.mockResolvedValueOnce([
      {
        id: 'of-match',
        flexibilidade_rota: false,
        origin_name: 'Talatona',
        destination_name: 'Centro',
        origin_lat: -8.9161,
        origin_lng: 13.2341,
        destination_lat: -8.8091,
        destination_lng: 13.2341,
        departure_time: '07:30',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 40000,
        modo_preco: 'POR_PASSAGEIRO',
      },
      {
        id: 'of-flex',
        flexibilidade_rota: true,
        departure_time: '07:30',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 40000,
        modo_preco: 'POR_PASSAGEIRO',
      },
    ]);

    render(
      <MemoryRouter
        initialEntries={['/explorar?origem=Talatona&destino=Centro&origem_lat=-8.916&origem_lng=13.234&destino_lat=-8.809&destino_lng=13.234']}
      >
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Boleias de Talatona para Centro' })).toBeInTheDocument();
    expect(screen.getByText('Talatona → Centro')).toBeInTheDocument();
    expect(screen.queryByTestId('explore-tabs')).not.toBeInTheDocument();
    expect(await screen.findByText('Talatona')).toBeInTheDocument();
    expect(screen.queryByText(/Oferta flexível/i)).not.toBeInTheDocument();
  });

  it('modo filtrado vazio: copy, Criar procura e Ver todas as boleias', async () => {
    listOfertasDisponiveis.mockResolvedValueOnce([]);

    render(
      <MemoryRouter
        initialEntries={['/explorar?origem=Viana&destino=Kilamba&origem_lat=-8.9&origem_lng=13.2&destino_lat=-9.0&destino_lng=13.3']}
      >
        <MarketplaceExplore />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('explore-filtered-empty')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Nenhuma boleia neste caminho' })).toBeInTheDocument();
    expect(screen.getByText('Cria uma procura e espera quem faz o mesmo caminho.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Criar procura' }));
    expect(navigate).toHaveBeenCalledWith('/auth?mode=register&role=passenger');

    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as boleias' }));
    expect(navigate).toHaveBeenCalledWith('/explorar');
  });

  it('Limpar remove filtro; Editar volta à landing com query', async () => {
    listOfertasDisponiveis.mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={['/explorar?origem=A&destino=B&origem_lat=1&origem_lng=2&destino_lat=3&destino_lng=4']}>
        <Routes>
          <Route path="/explorar" element={<MarketplaceExplore />} />
          <Route path="/" element={<div data-testid="landing-stub" />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('explore-filtered-header');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(navigate).toHaveBeenCalledWith('/explorar');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(navigate).toHaveBeenCalledWith('/?origem=A&destino=B&origem_lat=1&origem_lng=2&destino_lat=3&destino_lng=4');
  });
});
