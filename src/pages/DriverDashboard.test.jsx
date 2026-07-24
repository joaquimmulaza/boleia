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
// ─────────────────────────────────────────────────────────────────────────────
const { mockInsert, mockFrom, mockGetUser } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ insert: mockInsert, select: mockSelect }));
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
    const mockEqFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSelectFn = vi.fn(() => ({ eq: mockEqFn }));
    mockFrom.mockImplementation(() => ({
      insert: mockInsert,
      select: mockSelectFn,
    }));

    mockInsert.mockResolvedValue({ data: [{}], error: null });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CALL TO ACTION - VEÍCULO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Call To Action de Veículo', () => {
    it('renderiza o CTA se o utilizador não tiver veículo', async () => {
      render(<DriverDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Veículo não registado/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Registar Veículo Agora/i })).toBeInTheDocument();
      });
    });

    it('navega para /veiculo ao clicar no botão do CTA', async () => {
      render(<DriverDashboard />);

      let ctaButton;
      await waitFor(() => {
        ctaButton = screen.getByRole('button', { name: /Registar Veículo Agora/i });
      });

      fireEvent.click(ctaButton);
      expect(mockNavigate).toHaveBeenCalledWith('/veiculo');
    });

    it('não renderiza o CTA se o utilizador já tiver veículo', async () => {
      // Mock para retornar que o veículo existe
      const mockEqFn = vi.fn().mockImplementation((col) => {
        if (col === 'id_motorista') {
          return Promise.resolve({ data: [{ id: 'veh-1' }], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });
      const mockSelectFn = vi.fn(() => ({ eq: mockEqFn }));
      mockFrom.mockImplementation(() => ({
        select: mockSelectFn,
      }));

      render(<DriverDashboard />);

      await waitFor(() => {
        // CTA text should not be visible
        expect(screen.queryByText(/Veículo não registado/i)).not.toBeInTheDocument();
      });
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

      const mockEqFn = vi.fn().mockImplementation((col) => {
        if (col === 'driver_id') {
          return Promise.resolve({ data: [rotaMock], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });
      const mockSelectFn = vi.fn(() => ({ eq: mockEqFn }));
      mockFrom.mockImplementation(() => ({
        select: mockSelectFn,
      }));

      render(<DriverDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Talatona/i)).toBeInTheDocument();
        expect(screen.getByText(/Maianga/i)).toBeInTheDocument();
        expect(screen.getByText(/07:30/i)).toBeInTheDocument();
        expect(screen.getByText(/25000/i)).toBeInTheDocument();
      });

      // Se a rota existir, deve mostrar o FAB "Nova Rota" e não o texto vazio
      expect(screen.queryByText(/Aindaa nnão publicaste nenhuma rota diária/i)).not.toBeInTheDocument();
    });

    it('exibe mensagem e botão na área da rota quando não há rota', async () => {
      render(<DriverDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Aindaa nnão publicaste nenhuma rota diária/i)).toBeInTheDocument();
        // The button "Publicar Trajeto" should be rendered
        const buttons = screen.getAllByRole('button', { name: /Publicar Trajeto/i });
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. NAVEGAÇÃO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Navegação', () => {
    it('navega para /publicar-trajeto ao clicar em Publicar Trajeto', async () => {
      render(<DriverDashboard />);

      let publishButton;
      await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /Publicar Trajeto/i });
        publishButton = buttons[0];
      });

      fireEvent.click(publishButton);
      expect(mockNavigate).toHaveBeenCalledWith('/publicar-trajeto');
    });
  });
});
