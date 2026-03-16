import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PassengerDashboard from './PassengerDashboard';

vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: function() {
        this.remove = vi.fn();
        this.on = vi.fn();
        this.addControl = vi.fn();
      },
      Marker: vi.fn(function() {
        this.setLngLat = vi.fn().mockReturnThis();
        this.addTo = vi.fn().mockReturnThis();
        this.remove = vi.fn();
      })
    }
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock do módulo Supabase
// Simula a cadeia fluente: supabase.from().select().ilike().ilike()
// que será usada para pesquisar rotas na tabela routes
// ─────────────────────────────────────────────────────────────────────────────
const { mockGt, mockIlike, mockSelect, mockFrom, mockData } = vi.hoisted(() => {
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

  return { mockGt, mockIlike, mockSelect, mockFrom, mockData };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
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
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────
describe('PassengerDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Por defeito: pesquisa devolve array vazio (sem resultados)
    mockData.current = { data: [], error: null };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CONTENTOR DO MAPA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Contentor do Mapa', () => {
    it('renderiza um contentor para o mapa com data-testid="map-container"', () => {
      render(<PassengerDashboard />);
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. FORMULÁRIO DE PESQUISA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Formulário de Pesquisa', () => {
    it('renderiza um campo de input para "Ponto de Partida"', () => {
      render(<PassengerDashboard />);
      expect(screen.getByLabelText(/Ponto de Partida/i)).toBeInTheDocument();
    });

    it('renderiza um campo de input para "Ponto de Chegada"', () => {
      render(<PassengerDashboard />);
      expect(screen.getByLabelText(/Ponto de Chegada/i)).toBeInTheDocument();
    });

    it('renderiza um botão "Procurar Boleia"', () => {
      render(<PassengerDashboard />);
      expect(
        screen.getByRole('button', { name: /Procurar Boleia/i })
      ).toBeInTheDocument();
    });

    it('permite escrever no campo "Ponto de Partida"', () => {
      render(<PassengerDashboard />);
      const input = screen.getByLabelText(/Ponto de Partida/i);
      fireEvent.change(input, { target: { value: 'Talatona' } });
      expect(input.value).toBe('Talatona');
    });

    it('permite escrever no campo "Ponto de Chegada"', () => {
      render(<PassengerDashboard />);
      const input = screen.getByLabelText(/Ponto de Chegada/i);
      fireEvent.change(input, { target: { value: 'Maianga' } });
      expect(input.value).toBe('Maianga');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. LISTA DE RESULTADOS — Estado vazio
  // ───────────────────────────────────────────────────────────────────────────
  describe('Lista de Resultados — Estado Inicial', () => {
    it('renderiza um contentor para a lista de rotas', () => {
      render(<PassengerDashboard />);
      expect(screen.getByTestId('route-results-list')).toBeInTheDocument();
    });

    it('não mostra cartões de rota antes de fazer uma pesquisa', () => {
      render(<PassengerDashboard />);
      expect(screen.queryByTestId('route-card')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. INTEGRAÇÃO COM SUPABASE — Pesquisa e listagem de rotas
  // ───────────────────────────────────────────────────────────────────────────
  describe('Integração com Supabase — Pesquisa de Rotas', () => {
    it('chama supabase.from("routes") ao clicar em "Procurar Boleia" e filtra rotas com available_seats > 0', async () => {
      render(<PassengerDashboard />);

      fireEvent.change(screen.getByLabelText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByLabelText(/Ponto de Chegada/i), {
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

      render(<PassengerDashboard />);

      fireEvent.change(screen.getByLabelText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByLabelText(/Ponto de Chegada/i), {
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

      render(<PassengerDashboard />);

      fireEvent.change(screen.getByLabelText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByLabelText(/Ponto de Chegada/i), {
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

      render(<PassengerDashboard />);

      fireEvent.change(screen.getByLabelText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByLabelText(/Ponto de Chegada/i), {
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

      render(<PassengerDashboard />);

      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar Vaga/i })).toBeInTheDocument();
      });
    });

    it('adiciona um marcador ao mapa quando pesquisa retorna rotas', async () => {
      const maplibregl = await import('maplibre-gl');
      mockData.current = { data: [rotaDeTeste], error: null };

      render(<PassengerDashboard />);
      
      // ensure MapLibre dynamic import in useEffect completes and mapRef is set
      await new Promise((r) => setTimeout(r, 100));
      
      fireEvent.click(screen.getByRole('button', { name: /Procurar Boleia/i }));

      await waitFor(() => {
        expect(maplibregl.default.Marker).toHaveBeenCalled();
      });
    });
  });
});
