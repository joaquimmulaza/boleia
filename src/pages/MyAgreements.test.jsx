import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyAgreements from './MyAgreements';

// ─────────────────────────────────────────────────────────────────────────────
// Mock do módulo Supabase
// A cadeia fluente: supabase.auth.getUser() + .from().select().eq()
// ─────────────────────────────────────────────────────────────────────────────
const {
  mockFrom,
  mockGetUser,
  mockData,
  mockApproveAgreement,
  mockRejectAgreement,
} = vi.hoisted(() => {
  const mockData = { current: { data: [], error: null } };

  const mockEq = vi.fn(function () {
    return { then: (resolve) => resolve(mockData.current) };
  });
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  const mockGetUser = vi.fn();
  const mockApproveAgreement = vi.fn().mockResolvedValue(true);
  const mockRejectAgreement = vi.fn().mockResolvedValue(true);

  return {
    mockFrom,
    mockGetUser,
    mockData,
    mockApproveAgreement,
    mockRejectAgreement,
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  },
}));

vi.mock('../services/AgreementsService', () => ({
  approveAgreement: mockApproveAgreement,
  rejectAgreement: mockRejectAgreement,
}));

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Dados de teste
// ─────────────────────────────────────────────────────────────────────────────
const acordoPendente = {
  id: 'acordo-uuid-001',
  passenger_id: 'passageiro-123',
  route_id: 'rota-uuid-001',
  estado: 'pendente',
  routes: {
    origin_name: 'Talatona',
    destination_name: 'Maianga',
    departure_time: '07:30',
    monthly_price_per_seat: 25000,
  },
};

const acordoAtivo = {
  id: 'acordo-uuid-002',
  passenger_id: 'passageiro-456',
  route_id: 'rota-uuid-002',
  estado: 'ativo',
  routes: {
    origin_name: 'Kilamba',
    destination_name: 'Ingombota',
    departure_time: '08:00',
    monthly_price_per_seat: 30000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────
describe('MyAgreements Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.current = { data: [], error: null };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ESTADO DE LOADING
  // ───────────────────────────────────────────────────────────────────────────
  describe('Estado de Loading', () => {
    it('renderiza o componente sem erros', () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', user_metadata: { tipo_perfil: 'Passageiro' } } },
        error: null,
      });
      render(<MyAgreements />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. VISTA DO PASSAGEIRO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Vista do Passageiro', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'passageiro-123',
            user_metadata: { tipo_perfil: 'Passageiro' },
          },
        },
        error: null,
      });
    });

    it('exibe título "Meus Acordos"', async () => {
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Meus Acordos/i })).toBeInTheDocument();
      });
    });

    it('exibe badge PENDENTE e botão "Aguardando Confirmação" para acordo pendente', async () => {
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByText(/pendente/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Aguardando Confirmação/i })).toBeInTheDocument();
      });
    });

    it('exibe badge ATIVO e botão "Ver Detalhes" para acordo ativo', async () => {
      mockData.current = { data: [acordoAtivo], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByText(/ativo/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ver Detalhes/i })).toBeInTheDocument();
      });
    });

    it('renderiza o FAB de "Pedir Boleia" apenas para Passageiros', async () => {
      mockData.current = { data: [], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pedir Boleia/i })).toBeInTheDocument();
      });
    });

    it('NÃO renderiza botões de Aceitar/Rejeitar para Passageiro', async () => {
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByText(/pendente/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Aceitar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Rejeitar/i })).not.toBeInTheDocument();
    });

    it('exibe origem e destino da rota no cartão', async () => {
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByText(/Talatona/i)).toBeInTheDocument();
        expect(screen.getByText(/Maianga/i)).toBeInTheDocument();
      });
    });

    it('exibe mensagem de estado vazio quando não há acordos', async () => {
      mockData.current = { data: [], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByText(/Ainda não tens acordos/i)).toBeInTheDocument();
      });
    });

    it('exibe cartão com data-testid="agreement-card" por cada acordo', async () => {
      mockData.current = { data: [acordoPendente, acordoAtivo], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getAllByTestId('agreement-card')).toHaveLength(2);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. VISTA DO MOTORISTA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Vista do Motorista', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'motorista-123',
            user_metadata: { tipo_perfil: 'Motorista' },
          },
        },
        error: null,
      });
    });

    it('exibe título "Pedidos de Passageiros"', async () => {
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Pedidos de Passageiros/i })).toBeInTheDocument();
      });
    });

    it('NÃO renderiza o FAB de "Pedir Boleia" para Motoristas', async () => {
      mockData.current = { data: [], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Pedir Boleia/i })).not.toBeInTheDocument();
      });
    });

    it('renderiza botões "Aceitar" e "Rejeitar" para acordos PENDENTES', async () => {
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Aceitar/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Rejeitar/i })).toBeInTheDocument();
      });
    });

    it('NÃO renderiza botões de ação para acordos ATIVOS', async () => {
      mockData.current = { data: [acordoAtivo], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByText(/ativo/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Aceitar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Rejeitar/i })).not.toBeInTheDocument();
    });

    it('chama approveAgreement ao clicar em "Aceitar"', async () => {
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Aceitar/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /Aceitar/i }));
      await waitFor(() => {
        expect(mockApproveAgreement).toHaveBeenCalledWith(acordoPendente.id);
      });
    });

    it('chama rejectAgreement ao clicar em "Rejeitar"', async () => {
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Rejeitar/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /Rejeitar/i }));
      await waitFor(() => {
        expect(mockRejectAgreement).toHaveBeenCalledWith(acordoPendente.id);
      });
    });

    it('exibe mensagem de estado vazio quando não há pedidos', async () => {
      mockData.current = { data: [], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        expect(screen.getByText(/Ainda não tens pedidos de passageiros/i)).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. BADGES DE COR
  // ───────────────────────────────────────────────────────────────────────────
  describe('Badges de Estado', () => {
    it('badge PENDENTE tem classes de cor amber (bg-amber/10)', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'passageiro-123',
            user_metadata: { tipo_perfil: 'Passageiro' },
          },
        },
        error: null,
      });
      mockData.current = { data: [acordoPendente], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        const badge = screen.getByTestId('badge-estado');
        expect(badge.className).toMatch(/bg-amber\/10/);
        expect(badge.className).toMatch(/text-amber/);
      });
    });

    it('badge ATIVO tem classes de cor emerald (bg-emerald/10)', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'passageiro-123',
            user_metadata: { tipo_perfil: 'Passageiro' },
          },
        },
        error: null,
      });
      mockData.current = { data: [acordoAtivo], error: null };
      render(<MyAgreements />);
      await waitFor(() => {
        const badge = screen.getByTestId('badge-estado');
        expect(badge.className).toMatch(/bg-emerald\/10/);
        expect(badge.className).toMatch(/text-emerald/);
      });
    });
  });
});
