import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgreementsPage from './AgreementsPage';

// ─────────────────────────────────────────────────────────────────────────────
// Mock do módulo Supabase
//
// Simula a cadeia fluente usada pela página de Acordos:
//   supabase.auth.getUser()
//   supabase.from('acordos').select(...).eq('id_passageiro', user.id)
//
// A cadeia .eq() é resolvida como uma Promise para permitir `await`.
// ─────────────────────────────────────────────────────────────────────────────
const { mockEq, mockSelect, mockFrom, mockGetUser, mockData, mockUser } =
  vi.hoisted(() => {
    const mockUser = {
      current: { id: 'user-uuid-001', email: 'passageiro@boleia.co.ao' },
    };

    const mockData = { current: { data: [], error: null } };

    // .eq() é o fim da cadeia — devolve uma Promise
    const mockEq = vi.fn(function () {
      return Promise.resolve(mockData.current);
    });

    // .select() devolve o query builder com .eq()
    const mockSelect = vi.fn(() => ({ eq: mockEq }));

    // .from() devolve o query builder com .select()
    const mockFrom = vi.fn(() => ({ select: mockSelect }));

    // supabase.auth.getUser() devolve uma Promise com o utilizador
    const mockGetUser = vi.fn(() =>
      Promise.resolve({ data: { user: mockUser.current }, error: null })
    );

    return { mockEq, mockSelect, mockFrom, mockGetUser, mockData, mockUser };
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
// Dados de teste — acordo fictício alinhado com o schema: acordos
// ─────────────────────────────────────────────────────────────────────────────
const acordoDeTeste = {
  id: 'acordo-uuid-001',
  id_passageiro: 'user-uuid-001',
  ponto_partida: 'Talatona',
  ponto_chegada: 'Maianga',
  estado: 'Ativo',
  valor_mensal: 25000,
  hora_recolha: '07:30',
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────
describe('AgreementsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Por defeito: utilizador autenticado e sem acordos
    mockUser.current = { id: 'user-uuid-001', email: 'passageiro@boleia.co.ao' };
    mockData.current = { data: [], error: null };

    mockGetUser.mockResolvedValue({
      data: { user: mockUser.current },
      error: null,
    });
    mockEq.mockResolvedValue(mockData.current);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ESTRUTURA BÁSICA DA PÁGINA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Estrutura Básica da Página', () => {
    it('renderiza um título "Acordos" ou "As Minhas Boleias" na página', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /acordos|as minhas boleias/i })
        ).toBeInTheDocument();
      });
    });

    it('renderiza um botão "Pedir Boleia"', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Pedir Boleia/i })
        ).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ESTADO VAZIO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Estado Vazio — sem acordos', () => {
    it('exibe a mensagem "Ainda não tens boleias" quando não há acordos', async () => {
      mockData.current = { data: [], error: null };

      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(
          screen.getByText(/Ainda não tens boleias/i)
        ).toBeInTheDocument();
      });
    });

    it('não renderiza cartões de acordo quando a lista está vazia', async () => {
      mockData.current = { data: [], error: null };

      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(screen.queryByTestId('agreement-card')).not.toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. INTEGRAÇÃO COM SUPABASE — autenticação e carregamento de acordos
  // ───────────────────────────────────────────────────────────────────────────
  describe('Integração com Supabase — Carregamento de Acordos', () => {
    it('chama supabase.auth.getUser() para obter o utilizador autenticado', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
      });
    });

    it('chama supabase.from("acordos") para buscar os acordos', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('acordos');
      });
    });

    it('filtra por .eq("id_passageiro", user.id) com o id do utilizador autenticado', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(mockEq).toHaveBeenCalledWith(
          'id_passageiro',
          'user-uuid-001'
        );
      });
    });

    it('exibe um cartão por cada acordo devolvido pelo Supabase', async () => {
      mockData.current = { data: [acordoDeTeste], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(screen.getByTestId('agreement-card')).toBeInTheDocument();
      });
    });

    it('exibe múltiplos cartões quando existem vários acordos', async () => {
      const segundoAcordo = {
        ...acordoDeTeste,
        id: 'acordo-uuid-002',
        ponto_partida: 'Viana',
        ponto_chegada: 'Ingombota',
        estado: 'Pendente',
      };
      mockData.current = { data: [acordoDeTeste, segundoAcordo], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(screen.getAllByTestId('agreement-card')).toHaveLength(2);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. CONTEÚDO DO CARTÃO DE ACORDO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Conteúdo do Cartão de Acordo', () => {
    beforeEach(() => {
      mockData.current = { data: [acordoDeTeste], error: null };
      mockEq.mockResolvedValue(mockData.current);
    });

    it('mostra a rota no formato "Partida → Chegada"', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(screen.getByText(/Talatona/i)).toBeInTheDocument();
        expect(screen.getByText(/Maianga/i)).toBeInTheDocument();
      });
    });

    it('mostra o estado do acordo (Ativo)', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(screen.getByText(/Ativo/i)).toBeInTheDocument();
      });
    });

    it('mostra o estado Pendente quando o acordo está pendente', async () => {
      mockData.current = {
        data: [{ ...acordoDeTeste, estado: 'Pendente' }],
        error: null,
      };
      mockEq.mockResolvedValue(mockData.current);

      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(screen.getByText(/Pendente/i)).toBeInTheDocument();
      });
    });

    it('mostra o estado Cancelado quando o acordo está cancelado', async () => {
      mockData.current = {
        data: [{ ...acordoDeTeste, estado: 'Cancelado' }],
        error: null,
      };
      mockEq.mockResolvedValue(mockData.current);

      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(screen.getByText(/Cancelado/i)).toBeInTheDocument();
      });
    });

    it('mostra o valor mensal em Kz', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        // Aceita formatos: "25 000 Kz", "25.000 Kz", "25000 Kz", etc.
        expect(screen.getByText(/25[\s.,]*000|25000/i)).toBeInTheDocument();
      });
    });

    it('mostra a hora de recolha', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      await waitFor(() => {
        expect(screen.getByText(/07:30/i)).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. MODAL "PEDIR BOLEIA"
  // ───────────────────────────────────────────────────────────────────────────
  describe('Modal de Confirmação — Pedir Boleia', () => {
    it('o modal NÃO está visível antes de clicar em "Pedir Boleia"', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      // Espera que a página carregue
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Pedir Boleia/i })
        ).toBeInTheDocument();
      });

      expect(screen.queryByTestId('modal-pedir-boleia')).not.toBeInTheDocument();
    });

    it('abre o modal ao clicar em "Pedir Boleia"', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      const botao = await screen.findByRole('button', { name: /Pedir Boleia/i });
      fireEvent.click(botao);

      await waitFor(() => {
        expect(screen.getByTestId('modal-pedir-boleia')).toBeInTheDocument();
      });
    });

    it('o modal de confirmação contém um botão para confirmar', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      const botao = await screen.findByRole('button', { name: /Pedir Boleia/i });
      fireEvent.click(botao);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Confirmar|Criar Acordo/i })
        ).toBeInTheDocument();
      });
    });

    it('o modal de confirmação contém um botão para cancelar ou fechar', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      const botao = await screen.findByRole('button', { name: /Pedir Boleia/i });
      fireEvent.click(botao);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Cancelar|Fechar/i })
        ).toBeInTheDocument();
      });
    });

    it('fecha o modal ao clicar em "Cancelar"', async () => {
      render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

      const botao = await screen.findByRole('button', { name: /Pedir Boleia/i });
      fireEvent.click(botao);

      // Modal está aberto
      await waitFor(() => {
        expect(screen.getByTestId('modal-pedir-boleia')).toBeInTheDocument();
      });

      // Fechar o modal
      fireEvent.click(screen.getByRole('button', { name: /Cancelar|Fechar/i }));

      await waitFor(() => {
        expect(
          screen.queryByTestId('modal-pedir-boleia')
        ).not.toBeInTheDocument();
      });
    });
  });
});
