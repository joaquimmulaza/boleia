import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../services/GoogleMapsService', () => ({
  getPlacePredictions: vi.fn().mockResolvedValue([]),
  getPlaceDetails: vi.fn().mockResolvedValue({ lat: -8.839, lng: 13.289 }),
}));
import PassengerDashboard from './PassengerDashboard';

vi.mock('maplibre-gl', () => {
  class Map {
    constructor() {
      this.remove = vi.fn();
      this.on = vi.fn();
      this.once = vi.fn();
      this.isStyleLoaded = vi.fn().mockReturnValue(true);
      this.addControl = vi.fn();
      this.addSource = vi.fn();
      this.addLayer = vi.fn();
      this.getLayer = vi.fn().mockReturnValue(false);
      this.getSource = vi.fn().mockReturnValue(false);
      this.removeLayer = vi.fn();
      this.removeSource = vi.fn();
    }
  }
  const Popup = vi.fn(function() {
    this.setHTML = vi.fn().mockReturnThis();
    this.setDOMContent = vi.fn().mockReturnThis();
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
// ─────────────────────────────────────────────────────────────────────────────
const { mockGt, mockFrom, mockData, mockGetUser, mockEq, mockAcordosData } = vi.hoisted(() => {
  const mockData = { current: { data: [], error: null } };
  const mockAcordosData = { current: { data: [], error: null } };

  const mockIlike = vi.fn(function() { return this; });
  const mockGt = vi.fn(function() { return this; });
  const mockEq = vi.fn(function() { return this; });

  const mockQueryBuilder = {
    ilike: mockIlike,
    gt: mockGt,
    then: function(resolve) { resolve(mockData.current); }
  };
  
  const mockAcordosQueryBuilder = {
    eq: mockEq,
    then: function(resolve) { resolve(mockAcordosData.current); }
  };

  const mockSelect = vi.fn(function() { return this; });

  const mockFrom = vi.fn((table) => {
    if (table === 'routes') {
       return {
         select: vi.fn(() => mockQueryBuilder)
       };
    }
    if (table === 'acordos') {
       const selectObj = {
           select: vi.fn(() => ({
               eq: function(field, val) {
                   mockEq(field, val);
                   return mockAcordosQueryBuilder;
               }
           }))
       };
       return selectObj;
    }
    return { select: mockSelect };
  });
  const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'passenger-123' } }, error: null });

  return { mockGt, mockFrom, mockData, mockAcordosData, mockGetUser, mockEq };
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
  destination_lat: -8.810,
  destination_lng: 13.250,
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────
describe('PassengerDashboard Component', () => {
  vi.setConfig({ testTimeout: 10000 });
  beforeEach(() => {
    vi.clearAllMocks();

    mockData.current = { data: [], error: null };
    mockAcordosData.current = { data: [], error: null };
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

    it('renderiza um botão "Procurar Boleia"', async () => {
      await act(async () => { render(<PassengerDashboard />); });
      expect(
        screen.getByRole('button', { name: /Procurar Boleia/i })
      ).toBeInTheDocument();
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
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PROCESSO DE SOLICITAÇÃO DE VAGA E ESTADO EXISTENTE
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

    it('muda o estado do botão para "Vaga já solicitada" após sucesso e bloqueia clique', async () => {
      const btn = await setupSearchAndGetButton();
      await act(async () => { fireEvent.click(btn); });

      await waitFor(() => {
        const successBtn = screen.getByRole('button', { name: /Vaga já solicitada/i });
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
      expect(screen.getByText(/Ocorreu um erro ao solicitar a sua vaga/i)).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('Sad Path: exibe mensagem de erro específica para restrição de unicidade', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRequestSeat.mockRejectedValueOnce(new Error('Já solicitou uma vaga para esta rota.'));

      const btn = await setupSearchAndGetButton();
      await act(async () => { fireEvent.click(btn); });

      await waitFor(() => {
        expect(screen.getByText('Já solicitou uma vaga para esta rota.')).toBeInTheDocument();
      });
      consoleSpy.mockRestore();
    });
  });

  describe('Estado Existente', () => {
    it('renderiza o botão como "Vaga já solicitada" e desativado se já houver um acordo Pendente', async () => {
      mockData.current = { data: [rotaDeTeste], error: null };
      mockAcordosData.current = { data: [{ route_id: rotaDeTeste.id, estado: 'pendente' }], error: null };

      await act(async () => { render(<PassengerDashboard />); });

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Vaga já solicitada/i });
        expect(btn).toBeInTheDocument();
        expect(btn).toBeDisabled();
      });
    });

    it('renderiza o botão como "Boleia Ativa" e desativado se já houver um acordo Ativo', async () => {
      mockData.current = { data: [rotaDeTeste], error: null };
      mockAcordosData.current = { data: [{ route_id: rotaDeTeste.id, estado: 'ativo' }], error: null };

      await act(async () => { render(<PassengerDashboard />); });

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Boleia Ativa/i });
        expect(btn).toBeInTheDocument();
        expect(btn).toBeDisabled();
      });
    });

    it('prioritiza estado "pendente" ou "ativo" caso existam múltiplos acordos (ex: um cancelado anterior)', async () => {
      mockData.current = { data: [rotaDeTeste], error: null };
      // Array com um 'pendente' e depois um 'cancelado' simulando ordenação incorreta ou histórico
      mockAcordosData.current = { 
        data: [
          { route_id: rotaDeTeste.id, estado: 'pendente' },
          { route_id: rotaDeTeste.id, estado: 'cancelado' }
        ], 
        error: null 
      };

      await act(async () => { render(<PassengerDashboard />); });

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      // Button must still be disabled and show "Vaga já solicitada"
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Vaga já solicitada/i });
        expect(btn).toBeInTheDocument();
        expect(btn).toBeDisabled();
      });
    });
  });
});
