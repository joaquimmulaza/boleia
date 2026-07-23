import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import VehicleSetup from './VehicleSetup';

// ---------------------------------------------------------------------------
// Mocks — apenas o cliente Supabase; a lógica de conflito vive na BD.
// ---------------------------------------------------------------------------
const { mockGetUser, mockUpsert, mockEq, mockSelect } = vi.hoisted(() => {
  const mockUpsert = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert, select: mockSelect }));
  const mockGetUser = vi.fn();
  return { mockGetUser, mockUpsert, mockEq, mockSelect, mockFrom };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (() => {
      const mockEqFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockSelectFn = vi.fn(() => ({ eq: mockEqFn }));
      const mockUpsertFn = vi.fn().mockResolvedValue({ data: [{}], error: null });
      const mockFromFn = vi.fn(() => ({
        upsert: mockUpsertFn,
        select: mockSelectFn,
      }));
      // expõe para os testes via módulo
      globalThis.__mockSupabaseFrom = mockFromFn;
      globalThis.__mockSupabaseUpsert = mockUpsertFn;
      globalThis.__mockSupabaseSelect = mockSelectFn;
      globalThis.__mockSupabaseEq = mockEqFn;
      return mockFromFn;
    })(),
    auth: { getUser: mockGetUser },
  },
}));

const renderComponent = () =>
  render(
    <MemoryRouter>
      <VehicleSetup />
    </MemoryRouter>
  );

describe('VehicleSetup — Fluxo Upsert (Opção B — BD como Fonte da Verdade)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-motorista-uuid' } },
      error: null,
    });

    // Reset dos globais
    if (globalThis.__mockSupabaseSelect) {
      globalThis.__mockSupabaseEq.mockResolvedValue({ data: [], error: null });
      globalThis.__mockSupabaseUpsert.mockResolvedValue({ data: [{}], error: null });
    }
  });

  // --- Renderização ---
  describe('Renderização do Formulário', () => {
    it('renderiza o campo Marca/Modelo', async () => {
      renderComponent();
      expect(await screen.findByLabelText(/Marca\/Modelo/i)).toBeInTheDocument();
    });

    it('renderiza o campo Matrícula', async () => {
      renderComponent();
      expect(await screen.findByLabelText(/Matrícula/i)).toBeInTheDocument();
    });

    it('renderiza o campo Lugares Disponíveis', async () => {
      renderComponent();
      expect(await screen.findByLabelText(/Lugares Disponíveis/i)).toBeInTheDocument();
    });

    it('renderiza o botão Guardar Veículo', async () => {
      renderComponent();
      expect(await screen.findByRole('button', { name: /Guardar Veículo/i })).toBeInTheDocument();
    });
  });

  // --- Comportamento do Upsert ---
  describe('Submissão — .upsert() com onConflict: id_motorista', () => {
    const fillAndSubmit = async () => {
      renderComponent();
      await screen.findByLabelText(/Marca\/Modelo/i);

      fireEvent.change(screen.getByLabelText(/Marca\/Modelo/i), {
        target: { value: 'Toyota Hiace' },
      });
      fireEvent.change(screen.getByLabelText(/Matrícula/i), {
        target: { value: 'LD-12-34-AB' },
      });
      fireEvent.change(screen.getByLabelText(/Lugares Disponíveis/i), {
        target: { value: '7' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Guardar Veículo/i }));
    };

    it('chama .from("veiculos").upsert() com o payload correto incluindo id_motorista', async () => {
      await fillAndSubmit();

      await waitFor(() => {
        expect(globalThis.__mockSupabaseUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            id_motorista: 'user-motorista-uuid',
            marca_modelo: 'Toyota Hiace',
            matricula: 'LD-12-34-AB',
            lugares_disponiveis: 7,
          }),
          { onConflict: 'id_motorista' }
        );
      });
    });

    it('mostra mensagem de sucesso após upsert bem-sucedido', async () => {
      await fillAndSubmit();
      expect(await screen.findByRole('alert')).toHaveTextContent(/sucesso/i);
    });

    it('mostra mensagem de erro quando o upsert falha', async () => {
      globalThis.__mockSupabaseUpsert.mockResolvedValue({
        data: null,
        error: { message: 'DB constraint violation' },
      });

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });
});
