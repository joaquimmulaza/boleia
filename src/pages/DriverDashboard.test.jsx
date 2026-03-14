import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DriverDashboard from './DriverDashboard';

// ─────────────────────────────────────────────────────────────────────────────
// Mock do módulo Supabase
// Simula supabase.auth.getUser() e as operações de base de dados
// com uma cadeia fluente: .from().select().eq() e .from().insert()
// ─────────────────────────────────────────────────────────────────────────────
const { mockInsert, mockFrom, mockGetUser } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  // mockEq é o nó final da cadeia select().eq() — devolve dados vazios por defeito
  const mockEq = vi.fn();
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ insert: mockInsert, select: mockSelect }));
  // auth.getUser devolve um utilizador fictício por defeito
  const mockGetUser = vi.fn();
  return { mockInsert, mockFrom, mockGetUser, mockEq, mockSelect };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  },
}));

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────
describe('DriverDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Por defeito: utilizador autenticado com ID fictício
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Por defeito: sem veículo nem rota existentes (arrays vazios)
    // A cadeia .from().select().eq() devolve dados vazios
    const mockEqFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSelectFn = vi.fn(() => ({ eq: mockEqFn }));
    mockFrom.mockImplementation(() => ({
      insert: mockInsert,
      select: mockSelectFn,
    }));

    // Por defeito as operações de insert devolvem sucesso sem erro
    mockInsert.mockResolvedValue({ data: [{}], error: null });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. FORMULÁRIO DE VEÍCULO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Formulário de Veículo', () => {
    it('renderiza um campo "Marca/Modelo"', () => {
      render(<DriverDashboard />);
      expect(screen.getByLabelText(/Marca\/Modelo/i)).toBeInTheDocument();
    });

    it('renderiza um campo "Matrícula"', () => {
      render(<DriverDashboard />);
      expect(screen.getByLabelText(/Matrícula/i)).toBeInTheDocument();
    });

    it('renderiza um campo "Lugares Disponíveis"', () => {
      render(<DriverDashboard />);
      expect(screen.getByLabelText(/Lugares Disponíveis/i)).toBeInTheDocument();
    });

    it('renderiza um botão para guardar o veículo', () => {
      render(<DriverDashboard />);
      expect(
        screen.getByRole('button', { name: /Guardar Veículo/i })
      ).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. FORMULÁRIO DE ROTA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Formulário de Rota', () => {
    it('renderiza um campo "Ponto de Partida"', () => {
      render(<DriverDashboard />);
      expect(screen.getByLabelText(/Ponto de Partida/i)).toBeInTheDocument();
    });

    it('renderiza um campo "Ponto de Chegada"', () => {
      render(<DriverDashboard />);
      expect(screen.getByLabelText(/Ponto de Chegada/i)).toBeInTheDocument();
    });

    it('renderiza um campo "Hora de Recolha"', () => {
      render(<DriverDashboard />);
      expect(screen.getByLabelText(/Hora de Recolha/i)).toBeInTheDocument();
    });

    it('renderiza um campo "Valor Mensal Total (Kz)"', () => {
      render(<DriverDashboard />);
      expect(
        screen.getByLabelText(/Valor Mensal Total \(Kz\)/i)
      ).toBeInTheDocument();
    });

    it('renderiza um botão para guardar a rota', () => {
      render(<DriverDashboard />);
      expect(
        screen.getByRole('button', { name: /Guardar Rota/i })
      ).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. INTEGRAÇÃO COM SUPABASE — Veículo
  // ───────────────────────────────────────────────────────────────────────────
  describe('Submissão do formulário de Veículo ao Supabase', () => {
    it('chama supabase.from("veiculos").insert() com os dados corretos ao clicar em Guardar Veículo', async () => {
      render(<DriverDashboard />);

      fireEvent.change(screen.getByLabelText(/Marca\/Modelo/i), {
        target: { value: 'Toyota Corolla' },
      });
      fireEvent.change(screen.getByLabelText(/Matrícula/i), {
        target: { value: 'LD-00-00-AA' },
      });
      fireEvent.change(screen.getByLabelText(/Lugares Disponíveis/i), {
        target: { value: '3' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Guardar Veículo/i }));

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('veiculos');
        expect(mockInsert).toHaveBeenCalledWith([
          {
            marca_modelo: 'Toyota Corolla',
            matricula: 'LD-00-00-AA',
            lugares_disponiveis: 3,
          },
        ]);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. INTEGRAÇÃO COM SUPABASE — Rota
  // ───────────────────────────────────────────────────────────────────────────
  describe('Submissão do formulário de Rota ao Supabase', () => {
    it('chama supabase.from("rotas_diarias").insert() com os dados corretos ao clicar em Guardar Rota', async () => {
      render(<DriverDashboard />);

      fireEvent.change(screen.getByLabelText(/Ponto de Partida/i), {
        target: { value: 'Talatona' },
      });
      fireEvent.change(screen.getByLabelText(/Ponto de Chegada/i), {
        target: { value: 'Maianga' },
      });
      fireEvent.change(screen.getByLabelText(/Hora de Recolha/i), {
        target: { value: '07:30' },
      });
      fireEvent.change(screen.getByLabelText(/Valor Mensal Total \(Kz\)/i), {
        target: { value: '25000' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Guardar Rota/i }));

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('rotas_diarias');
        expect(mockInsert).toHaveBeenCalledWith([
          {
            ponto_partida: 'Talatona',
            ponto_chegada: 'Maianga',
            hora_recolha: '07:30',
            valor_mensal_total: 25000,
          },
        ]);
      });
    });
  });
});
