import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../services/GoogleMapsService', () => ({
  getPlacePredictions: vi.fn().mockResolvedValue([]),
  getPlaceDetails: vi.fn().mockResolvedValue({ lat: -8.839, lng: 13.289 }),
}));
import PassengerDashboard from './PassengerDashboard';

vi.mock('maplibre-gl', () => {
  const Map = function() {
    this.remove = vi.fn();
    this.on = vi.fn();
    this.addControl = vi.fn();
  };
  const Popup = vi.fn(function() {
    this.setHTML = vi.fn().mockReturnThis();
    this.addTo = vi.fn().mockReturnThis();
  });
  const Marker = vi.fn(function() {
    this.setLngLat = vi.fn().mockReturnThis();
    this.setPopup = vi.fn().mockReturnThis();
    this.addTo = vi.fn().mockReturnThis();
    this.remove = vi.fn();
  });
  const GeolocateControl = vi.fn();

  return {
    default: {
      Map,
      Popup,
      Marker,
      GeolocateControl
    }
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock do módulo Supabase
// Simula a cadeia fluente: supabase.from().select().ilike().ilike()
// que será usada para pesquisar rotas na tabela routes
// ─────────────────────────────────────────────────────────────────────────────
const { mockGt, mockFrom, mockData, mockGetUser } = vi.hoisted(() => {
  const mockData = { current: { data: [], error: null } };
  const mockIlike = vi.fn(function() { return this; });
  const mockGt = vi.fn(function() { return this; });
  const mockQueryBuilder = {
    ilike: mockIlike,
    gt: mockGt,
    then: function(resolve) { resolve(mockData.current); }
  };
  
  const mockSelect = vi.fn(() => mockQueryBuilder);
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'passenger-123' } }, error: null });

  return { mockGt, mockFrom, mockData, mockGetUser };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: mockGetUser
    }
  },
}));

const { mockRequestSeat } = vi.hoisted(() => {
  return { mockRequestSeat: vi.fn() };
});

vi.mock('../services/AgreementsService', () => ({
  requestSeat: mockRequestSeat
}));

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Dados de teste — rota fictícia que o mock do Supabase vai devolvendo
// Alinhados com o schema: routes
// ─────────────────────────────────────────────────────────────────────────────
const rotaDeTeste = {
  id: 'rota-uuid-001',
  origin_name: 'Talatona',
  destination_name: 'Maianga',
  departure_time: '07:30',
  return_time: '17:30',
  available_seats: 3,
  monthly_price_per_seat: 25000,
  origin_lat: -8.840,
  origin_lng: 13.280,
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────
describe('PassengerDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Por defeito: pesquisa devolve array vazio (sem resultados)
    mockData.current = { data: [], error: null };
    mockRequestSeat.mockResolvedValue({});
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CONTENTOR DO MAPA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Contentor do Mapa', () => {
    it('renderiza um contentor para o mapa com data-testid="map-container"', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. FORMULÁRIO DE PESQUISA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Formulário de Pesquisa', () => {
    it('renderiza um campo de input para "Ponto de Partida"', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      expect(screen.getByPlaceholderText(/Ponto de Partida/i)).toBeInTheDocument();
    });

    it('renderiza um campo de input para "Ponto de Chegada"', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      expect(screen.getByPlaceholderText(/Ponto de Chegada/i)).toBeInTheDocument();
    });

    it('renderiza um botão "Procurar Boleia"', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      expect(
        screen.getByRole('button', { name: /Procurar Boleia/i })
      ).toBeInTheDocument();
    });

    it('permite escrever no campo "Ponto de Partida"', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      const input = screen.getByPlaceholderText(/Ponto de Partida/i);
      await act(async () => { fireEvent.change(input, { target: { value: 'Talatona' } }); });
      expect(input.value).toBe('Talatona');
    });

    it('permite escrever no campo "Ponto de Chegada"', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      const input = screen.getByPlaceholderText(/Ponto de Chegada/i);
      await act(async () => { fireEvent.change(input, { target: { value: 'Maianga' } }); });
      expect(input.value).toBe('Maianga');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. LISTA DE RESULTADOS — Estado vazio
  // ───────────────────────────────────────────────────────────────────────────
  describe('Lista de Resultados — Estado Inicial', () => {
    it('renderiza um contentor para a lista de rotas', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      expect(screen.getByTestId('route-results-list')).toBeInTheDocument();
    });

    it('não mostra cartões de rota antes de fazer uma pesquisa', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      expect(screen.queryByTestId('route-card')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. INTEGRAÇÃO COM SUPABASE — Pesquisa e listagem de rotas
  // ───────────────────────────────────────────────────────────────────────────
  describe('Integração com Supabase — Pesquisa de Rotas', () => {
    it('chama supabase.from("routes") ao clicar em "Procurar Boleia" e filtra rotas com available_seats > 0', async () => {
      await act(async () => { render(<PassengerDashboard />); });

      fireEvent.change(screen.getByPlaceholderText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Ponto de Chegada/i), {
        target: { value: 'Maianga' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('routes');
        expect(mockGt).toHaveBeenCalledWith('available_seats', 0);
      });
    });

    it('exibe um cartão por cada rota devolvida pelo Supabase', async () => {
      // Configura o mock para devolver a rota de teste nesta suite
      mockData.current = { data: [rotaDeTeste], error: null };

      await act(async () => { render(<PassengerDashboard />); });

      fireEvent.change(screen.getByPlaceholderText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Ponto de Chegada/i), {
        target: { value: 'Maianga' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      // Verifica que o cartão da rota de teste aparece na listagem
      await waitFor(() => {
        expect(screen.getByTestId('route-card')).toBeInTheDocument();
      });
    });

    it('exibe o ponto de partida e chegada da rota encontrada no cartão', async () => {
      mockData.current = { data: [rotaDeTeste], error: null };

      await act(async () => { render(<PassengerDashboard />); });

      fireEvent.change(screen.getByPlaceholderText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Ponto de Chegada/i), {
        target: { value: 'Maianga' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        expect(screen.getByText(/Talatona/i)).toBeInTheDocument();
        expect(screen.getByText(/Maianga/i)).toBeInTheDocument();
      });
    });

    it('exibe o valor mensal da rota encontrada no cartão (em Kz)', async () => {
      mockData.current = { data: [rotaDeTeste], error: null };

      await act(async () => { render(<PassengerDashboard />); });

      fireEvent.change(screen.getByPlaceholderText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Ponto de Chegada/i), {
        target: { value: 'Maianga' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        // O componente deve exibir o valor com "Kz" na unidade
        expect(screen.getByText(/25[\s.,]*000|25000/i)).toBeInTheDocument();
      });
    });

    it('renderiza o botão "Solicitar Vaga" no cartão da rota', async () => {
      mockData.current = { data: [rotaDeTeste], error: null };

      await act(async () => { render(<PassengerDashboard />); });

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar Vaga/i })).toBeInTheDocument();
      });
    });

    it('adiciona um marcador ao mapa quando pesquisa retorna rotas', async () => {
      const maplibregl = await import('maplibre-gl');
      mockData.current = { data: [rotaDeTeste], error: null };

      await act(async () => { render(<PassengerDashboard />); });
      
      // ensure MapLibre dynamic import in useEffect completes and mapRef is set
      await new Promise((r) => setTimeout(r, 100));
      
      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        expect(maplibregl.default.Marker).toHaveBeenCalled();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PROCESSO DE SOLICITAÇÃO DE VAGA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Processo de Solicitar Vaga', () => {
    beforeEach(async () => {
      mockData.current = { data: [rotaDeTeste], error: null };
    });

    const setupSearchAndGetButton = async () => {
      await act(async () => { render(<PassengerDashboard />); });
      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar Vaga/i })).toBeInTheDocument();
      });
      return screen.getByRole('button', { name: /Solicitar Vaga/i });
    };

    it('chama supabase.auth.getUser e requestSeat ao clicar em Solicitar Vaga', async () => {
      const btn = await setupSearchAndGetButton();
      
      await act(async () => { fireEvent.click(btn); });

      await waitFor(() => {
        expect(mockGetUser).toHaveBeenCalled();
        expect(mockRequestSeat).toHaveBeenCalledWith(rotaDeTeste.id, 'passenger-123');
      });
    });

    it('muda o estado do botão para "A processar..." e desativa o botão durante a solicitação', async () => {
      // Fazemos o mock do requestSeat demorar um pouco
      let resolveRequest;
      mockRequestSeat.mockImplementationOnce(() => new Promise(resolve => {
        resolveRequest = resolve;
      }));

      const btn = await setupSearchAndGetButton();
      await act(async () => { fireEvent.click(btn); });

      await waitFor(() => {
        const processingBtn = screen.getByRole('button', { name: /A processar.../i });
        expect(processingBtn).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /A processar.../i })).toBeDisabled();

      // Resolvemos a promessa para não deixar pendente
      await act(async () => { resolveRequest({}); });
    });

    it('muda o estado do botão para "Aguardando Confirmação" após sucesso e bloqueia clique', async () => {
      const btn = await setupSearchAndGetButton();
      await act(async () => { fireEvent.click(btn); });

      await waitFor(() => {
        const successBtn = screen.getByRole('button', { name: /Aguardando Confirmação/i });
        expect(successBtn).toBeInTheDocument();
        expect(successBtn).toBeDisabled();
        expect(successBtn.className).toMatch(/bg-yellow-100|text-yellow-700/i);
      });
    });

    it('Sad Path: exibe mensagem de erro e restaura botão "Solicitar Vaga" caso requestSeat falhe', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRequestSeat.mockRejectedValueOnce(new Error('Erro ao solicitar vaga. Tente novamente.'));

      const btn = await setupSearchAndGetButton();
      await act(async () => { fireEvent.click(btn); });

      // Botão passa para status inicial de volta
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar Vaga/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Solicitar Vaga/i })).not.toBeDisabled();
      });

      // E exibe a notificação de erro algures no ecrã
      expect(screen.getByText(/Erro ao solicitar vaga. Tente novamente./i)).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });
});

