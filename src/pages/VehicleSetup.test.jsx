import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import VehicleSetup from './VehicleSetup';

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

describe('VehicleSetup Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockEqFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSelectFn = vi.fn(() => ({ eq: mockEqFn }));
    mockFrom.mockImplementation(() => ({
      insert: mockInsert,
      select: mockSelectFn,
    }));

    mockInsert.mockResolvedValue({ data: [{}], error: null });
  });

  describe('Formulário de Veículo', () => {
    const renderComponent = () => render(<MemoryRouter><VehicleSetup /></MemoryRouter>);

    it('renderiza um campo "Marca/Modelo"', () => {
      renderComponent();
      expect(screen.getByLabelText(/Marca\/Modelo/i)).toBeInTheDocument();
    });

    it('renderiza um campo "Matrícula"', () => {
      renderComponent();
      expect(screen.getByLabelText(/Matrícula/i)).toBeInTheDocument();
    });

    it('renderiza um campo "Lugares Disponíveis"', () => {
      renderComponent();
      expect(screen.getByLabelText(/Lugares Disponíveis/i)).toBeInTheDocument();
    });

    it('renderiza um botão para guardar o veículo', () => {
      renderComponent();
      expect(
        screen.getByRole('button', { name: /Guardar Veículo/i })
      ).toBeInTheDocument();
    });
  });
});
