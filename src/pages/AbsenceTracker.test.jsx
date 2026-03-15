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
// Mock de react-router-dom para simular a rota parametrizada
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useParams: () => ({ acordoId: 'acordo-uuid-001' }),
  useNavigate: () => vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Dados de teste — falta fictícia alinhada com o requisito
// ─────────────────────────────────────────────────────────────────────────────
const faltaDeTeste = {
  id: 'falta-uuid-001',
  id_acordo: 'acordo-uuid-001',
  data_falta: '2023-10-15',
  tipo_falta: 'Passageiro',
  desconto_kz: 1500,
  observacao: 'Trabalho extra',
};

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
  // 1. ESTRUTURA BÁSICA E INTEGRAÇÃO SUPABASE
  // ───────────────────────────────────────────────────────────────────────────
  describe('Integração e Listagem Inicial', () => {
    it('chama supabase.from("faltas") e filtra por id_acordo', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('faltas');
        expect(mockEq).toHaveBeenCalledWith('id_acordo', 'acordo-uuid-001');
      });
    });

    it('exibe a mensagem de estado vazio quando não há faltas', async () => {
      mockData.current = { data: [], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(screen.getByText(/Não há faltas/i)).toBeInTheDocument();
      });
    });

    it('exibe o botão Registar Falta', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Registar Falta/i })
        ).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. LISTAGEM DE FALTAS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Listagem de Faltas', () => {
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

    it('mostra o valor de desconto_kz da falta', async () => {
      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(screen.getAllByText(/1[\s.,]*500|1500/i)[0]).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CARD DE RESUMO (SOMA DOS DESCONTOS)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Card de Resumo (Descontos)', () => {
    it('exibe 0 Kz no total se não houver faltas', async () => {
      mockData.current = { data: [], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<AbsenceTracker />);

      await waitFor(() => {
        expect(screen.getByText(/0/)).toBeInTheDocument();
      });
    });

    it('soma e exibe o desconto_kz total para múltiplas faltas', async () => {
      const segundaFalta = {
        ...faltaDeTeste,
        id: 'falta-uuid-002',
        desconto_kz: 2000,
      };
      mockData.current = { data: [faltaDeTeste, segundaFalta], error: null };
      mockEq.mockResolvedValue(mockData.current);

      render(<AbsenceTracker />);

      await waitFor(() => {
        // 1500 + 2000 = 3500
        expect(screen.getByText(/3[\s.,]*500|3500/)).toBeInTheDocument();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. MODAL DE REGISTO DE FALTA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Modal de Registo de Falta', () => {
    it('o modal está oculto por defeito', async () => {
      render(<AbsenceTracker />);
      expect(screen.queryByTestId('modal-registar-falta')).not.toBeInTheDocument();
    });

    it('abre o modal ao clicar em Registar Falta', async () => {
      render(<AbsenceTracker />);

      const botao = await screen.findByRole('button', { name: /Registar Falta/i });
      fireEvent.click(botao);

      await waitFor(() => {
        expect(screen.getByTestId('modal-registar-falta')).toBeInTheDocument();
      });
    });

    it('tem campos para: Data, Tipo (select Passageiro/Motorista), Observação', async () => {
      render(<AbsenceTracker />);

      const botao = await screen.findByRole('button', { name: /Registar Falta/i });
      fireEvent.click(botao);

      await waitFor(() => {
        expect(screen.getByTestId('modal-registar-falta')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Data/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Tipo/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /Tipo/i })).toBeInTheDocument(); // Select
      expect(screen.getByText(/Passageiro/i)).toBeInTheDocument(); // Opções
      expect(screen.getByText(/Motorista/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Observação/i)).toBeInTheDocument();
    });
  });
});
