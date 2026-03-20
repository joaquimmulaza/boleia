import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DriverDashboard from './DriverDashboard';

// ─────────────────────────────────────────────────────────────────────────────
// Mock do módulo react-router-dom
// ─────────────────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

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



// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────
describe('DriverDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

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
  // 2. EXIBIÇÃO DA ROTA (Read-only)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Exibição da Rota Diária', () => {
    it('renderiza os dados da rota quando estes existem', async () => {
      // Configuramos o mock para devolver uma rota existente
      const rotaMock = {
        origin_name: 'Talatona',
        destination_name: 'Maianga',
        departure_time: '07:30',
        monthly_price_per_seat: 25000,
      };

      const mockEqFn = vi.fn().mockResolvedValue({ data: [rotaMock], error: null });
      const mockSelectFn = vi.fn(() => ({ eq: mockEqFn }));
      mockFrom.mockImplementation(() => ({
        insert: mockInsert,
        select: mockSelectFn,
      }));

      render(<DriverDashboard />);

      // Apenas devemos ver os dados (textos) rendered, e não formulários com estes labels
      await waitFor(() => {
        expect(screen.getByText(/Talatona/i)).toBeInTheDocument();
        expect(screen.getByText(/Maianga/i)).toBeInTheDocument();
        expect(screen.getByText(/07:30/i)).toBeInTheDocument();
        expect(screen.getByText(/25000/i)).toBeInTheDocument();
      });

      // O botão de guardar rota não deve existir
      expect(screen.queryByRole('button', { name: /Guardar Rota/i })).not.toBeInTheDocument();
      // O input de Ponto de Partida não deve existir
      expect(screen.queryByLabelText(/Ponto de Partida/i)).not.toBeInTheDocument();
    });

    it('exibe mensagem de rota não definida quando não há rota', async () => {
      // Mock já configurado no beforeEach para devolver array vazio []

      render(<DriverDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Ainda não publicaste nenhuma rota diária/i)).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. NAVEGAÇÃO / FAB
  // ───────────────────────────────────────────────────────────────────────────
  describe('Navegação (Floating Action Button)', () => {
    it('renderiza o botão "Publicar Trajeto" e navega corretamente', () => {
      render(<DriverDashboard />);

      const fabButton = screen.getByRole('button', { name: /Publicar Trajeto/i });
      expect(fabButton).toBeInTheDocument();

      fireEvent.click(fabButton);
      expect(mockNavigate).toHaveBeenCalledWith('/publicar-trajeto');
    });
  });
});
