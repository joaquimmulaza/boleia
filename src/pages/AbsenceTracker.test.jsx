import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AbsenceTracker from './AbsenceTracker';

// ─────────────────────────────────────────────────────────────────────────────
// Mock do módulo Supabase
//
// Simula a cadeia fluente usada pela página de Faltas:
//   supabase.from('faltas').select(...).eq('id_acordo', acordoId)
// ─────────────────────────────────────────────────────────────────────────────
const { mockEq, mockSelect, mockFrom, mockData } =
  vi.hoisted(() => {
    const mockData = { current: { data: [], error: null } };

    // .eq() é o fim da cadeia — devolve uma Promise
    const mockEq = vi.fn(function () {
      return Promise.resolve(mockData.current);
    });

    // .select() devolve o query builder com .eq()
    const mockSelect = vi.fn(() => ({ eq: mockEq }));

    // .from() devolve o query builder com .select()
    const mockFrom = vi.fn(() => ({ select: mockSelect }));

    return { mockEq, mockSelect, mockFrom, mockData };
  });

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Dados de teste — falta fictícia alinhada com o schema
// ─────────────────────────────────────────────────────────────────────────────
const faltaDeTeste = {
  id: 'falta-uuid-001',
  id_acordo: 'acordo-uuid-123',
  data_falta: '2023-10-15',
  tipo_falta: 'Passageiro',
  valor_desconto: 1500,
  observacao: 'Doente',
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock de useParams para simular a rota com um ID de acordo
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'acordo-uuid-123' }),
  useNavigate: () => vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Suite principal
// ─────────────────────────────────────────────────────────────────────────────
describe('AbsenceTracker Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Por defeito: sem faltas
    mockData.current = { data: [], error: null };
    mockEq.mockResolvedValue(mockData.current);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ESTRUTURA BÁSICA DA PÁGINA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Estrutura Básica da Página', () => {
    it('renderiza o título da página', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Registo de Faltas/i })
        ).toBeInTheDocument();
      });
    });

    it('renderiza um botão "Registar Falta"', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Registar Falta/i })
        ).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ESTADO VAZIO E TOTAIS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Estado Vazio e Totais', () => {
    it('exibe a mensagem "Nenhuma falta registada" quando não há faltas', async () => {
      mockData.current = { data: [], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(
          screen.getByText(/Nenhuma falta registada/i)
        ).toBeInTheDocument();
      });
    });

    it('exibe o total de descontos como 0 Kz quando não há faltas', async () => {
      mockData.current = { data: [], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(
          screen.getByText(/Total de Descontos|Total a Descontar/i)
        ).toBeInTheDocument();
        expect(screen.getByText(/0/i)).toBeInTheDocument();
      });
    });

    it('calcula e exibe o total de descontos corretamente com múltiplas faltas', async () => {
      const segundaFalta = {
        ...faltaDeTeste,
        id: 'falta-uuid-002',
        valor_desconto: 2000,
      };
      mockData.current = { data: [faltaDeTeste, segundaFalta], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<AbsenceTracker />);

      await waitFor(() => {
        // 1500 + 2000 = 3500
        expect(screen.getByText(/3[\s.,]*500|3500/i)).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. INTEGRAÇÃO COM SUPABASE E LISTAGEM
  // ───────────────────────────────────────────────────────────────────────────
  describe('Integração com Supabase — Carregamento de Faltas', () => {
    it('chama supabase.from("faltas") para buscar as faltas', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('faltas');
      });
    });

    it('filtra por .eq("id_acordo", acordoId)', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(mockEq).toHaveBeenCalledWith('id_acordo', 'acordo-uuid-123');
      });
    });

    it('exibe um cartão/item por cada falta devolvida pelo Supabase', async () => {
      mockData.current = { data: [faltaDeTeste], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(screen.getByTestId('absence-card')).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. CONTEÚDO DA FALTA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Conteúdo do Registo de Falta', () => {
    beforeEach(() => {
      mockData.current = { data: [faltaDeTeste], error: null };
      mockEq.mockResolvedValue(mockData.current);
    });

    it('mostra a data da falta', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(screen.getByText(/2023-10-15|15\/10\/2023/i)).toBeInTheDocument();
      });
    });

    it('mostra o tipo da falta (Passageiro/Motorista)', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(screen.getByText(/Passageiro/i)).toBeInTheDocument();
      });
    });

    it('mostra o valor do desconto em Kz', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(screen.getAllByText(/1[\s.,]*500|1500/i)[0]).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. MODAL "REGISTAR FALTA"
  // ───────────────────────────────────────────────────────────────────────────
  describe('Modal — Registar Falta', () => {
    it('o modal NÃO está visível antes de clicar em "Registar Falta"', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Registar Falta/i })
        ).toBeInTheDocument();
      });

      expect(screen.queryByTestId('modal-registar-falta')).not.toBeInTheDocument();
    });

    it('abre o modal ao clicar em "Registar Falta"', async () => {
      render(<AbsenceTracker />);

      const botao = await screen.findByRole('button', { name: /Registar Falta/i });
      fireEvent.click(botao);

      await waitFor(() => {
        expect(screen.getByTestId('modal-registar-falta')).toBeInTheDocument();
      });
    });

    it('o modal contém os campos: Data, Tipo e Observação', async () => {
      render(<AbsenceTracker />);

      const botao = await screen.findByRole('button', { name: /Registar Falta/i });
      fireEvent.click(botao);

      await waitFor(() => {
        expect(screen.getByLabelText(/Data/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Tipo/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Observação/i)).toBeInTheDocument();
      });
    });
  });
});
