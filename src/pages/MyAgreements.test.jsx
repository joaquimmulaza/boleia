import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import MyAgreements from './MyAgreements';
import { supabase } from '../lib/supabase';
import * as AgreementsService from '../services/AgreementsService';

// Mock das libs
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock('../services/AgreementsService', () => ({
  approveAgreement: vi.fn(),
  rejectAgreement: vi.fn(),
}));

describe('MyAgreements Component', () => {
  let mockSelect, mockEq, mockSingle, mockIn;

  const renderComponent = async () => {
      await act(async () => { render(<MyAgreements />); });
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockSingle = vi.fn();
    mockIn = vi.fn().mockReturnValue({ data: [], error: null });
    mockEq = vi.fn().mockReturnValue({ single: mockSingle });

    // Default chain for 'perfis'
    mockSingle.mockResolvedValue({ data: { tipo_perfil: 'Passageiro' }, error: null });

    // Default chain for 'acordos'
    mockSelect = vi.fn().mockReturnValue({ eq: mockEq, in: mockIn, data: [], error: null });

    supabase.from.mockImplementation((table) => {
        if (table === 'perfis') return { select: () => ({ eq: mockEq }) };
        if (table === 'rotas') return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [{id: 1}], error: null }) }) };
        if (table === 'routes') return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [{id: 1}], error: null }) }) };
        if (table === 'acordos') {
            const selectObj = {
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                in: vi.fn().mockResolvedValue({ data: [], error: null })
            }
            return { select: vi.fn().mockReturnValue(selectObj) };
        }
    });

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', user_metadata: { tipo_perfil: 'Passageiro' } } },
      error: null,
    });
  });

  const setupMocksForRole = (role, acordosData = []) => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', user_metadata: { tipo_perfil: role } } },
        error: null,
      });

      supabase.from.mockImplementation((table) => {
        if (table === 'routes') return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [{id: 1}], error: null }) }) };
        if (table === 'acordos') {
            const selectObj = {
                eq: vi.fn().mockResolvedValue({ data: acordosData, error: null }),
                in: vi.fn().mockResolvedValue({ data: acordosData, error: null })
            }
            return { select: vi.fn().mockReturnValue(selectObj) };
        }
    });
  };

  const acordoPendentePassageiro = {
    id: 'acordo-1',
    estado: 'Pendente',
    routes: { origin_name: 'Viana', destination_name: 'Mutamba', motorista: { nome: 'Motorista Teste' } }
  };

  const acordoAtivoPassageiro = {
    id: 'acordo-2',
    estado: 'Ativo',
    routes: { origin_name: 'Cacuaco', destination_name: 'Talatona', motorista: { nome: 'Motorista 2' } }
  };

  const acordoPendenteMotorista = {
     id: 'acordo-3',
     estado: 'Pendente',
     routes: { origin_name: 'Benfica', destination_name: 'Maculusso' },
     passageiro: { nome: 'Passageiro Teste' }
  };

  const acordoAtivoMotorista = {
     id: 'acordo-4',
     estado: 'Ativo',
     routes: { origin_name: 'Kilamba', destination_name: 'Baixa' },
     passageiro: { nome: 'Outro Passageiro' }
  };

  describe('Renderização Comum', () => {
    it('renderiza o componente sem erros', async () => {
      await renderComponent();
      await waitFor(() => expect(screen.getByText('Boleia Certa')).toBeInTheDocument());
    });

    it('exibe título "Meus Acordos" quando Passageiro', async () => {
      setupMocksForRole('Passageiro');
      await renderComponent();
      await waitFor(() => expect(screen.getByText('Meus Acordos')).toBeInTheDocument());
    });
  });

  describe('Visão de Passageiro', () => {
    it('exibe badge PENDENTE e botão "Aguardando Confirmação" para acordo pendente', async () => {
      setupMocksForRole('Passageiro', [acordoPendentePassageiro]);
      await renderComponent();
      await waitFor(() => {
        const badges = screen.getAllByTestId('badge-estado');
        expect(badges.some(b => b.textContent.match(/pendente/i))).toBeTruthy();
        expect(screen.getByText('Aguardando Confirmação')).toBeInTheDocument();
      });
    });

    it('exibe badge ATIVO e botão "Ver Detalhes" para acordo ativo', async () => {
      setupMocksForRole('Passageiro', [acordoAtivoPassageiro]);
      await renderComponent();
      await waitFor(() => {
        const badges = screen.getAllByTestId('badge-estado');
        expect(badges.some(b => b.textContent.match(/ativo/i))).toBeTruthy();
        expect(screen.getByText('Ver Detalhes')).toBeInTheDocument();
      });
    });

    it('renderiza o FAB de "Pedir Boleia" apenas para Passageiros', async () => {
      setupMocksForRole('Passageiro');
      await renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Pedir Boleia')).toBeInTheDocument();
      });
    });

    it('NÃO renderiza botões de Aceitar/Rejeitar para Passageiro', async () => {
      setupMocksForRole('Passageiro');
      await renderComponent();
      await waitFor(() => {
         expect(screen.queryByText('Aceitar')).not.toBeInTheDocument();
         expect(screen.queryByText('Rejeitar')).not.toBeInTheDocument();
      });
    });

    it('exibe origem e destino da rota no cartão', async () => {
      setupMocksForRole('Passageiro', [acordoPendentePassageiro]);
      await renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Viana → Mutamba/)).toBeInTheDocument();
      });
    });

    it('exibe mensagem de estado vazio quando não há acordos', async () => {
        setupMocksForRole('Passageiro', []);
        await renderComponent();
        await waitFor(() => {
            expect(screen.getByText('Ainda não tens acordos. Pede a tua primeira boleia!')).toBeInTheDocument();
        });
    });

    it('exibe cartão com data-testid="agreement-card" por cada acordo', async () => {
        setupMocksForRole('Passageiro', [acordoPendentePassageiro, acordoAtivoPassageiro]);
        await renderComponent();
        await waitFor(() => {
            expect(screen.getAllByTestId('agreement-card').length).toBe(2);
        });
    });
  });

  describe('Visão de Motorista', () => {
    it('exibe título "Pedidos de Passageiros"', async () => {
      setupMocksForRole('Motorista', [acordoPendenteMotorista, acordoAtivoMotorista]);
      await renderComponent();
      await waitFor(() => expect(screen.getByText('Pedidos de Passageiros')).toBeInTheDocument());
    });

    it('NÃO renderiza o FAB de "Pedir Boleia" para Motoristas', async () => {
      setupMocksForRole('Motorista', [acordoPendenteMotorista, acordoAtivoMotorista]);
      await renderComponent();
      await waitFor(() => {
         expect(screen.queryByText('Pedir Boleia')).not.toBeInTheDocument();
      });
    });

    it('renderiza botões "Aceitar" e "Rejeitar" para acordos PENDENTES', async () => {
      setupMocksForRole('Motorista', [acordoPendenteMotorista, acordoAtivoMotorista]);
      await renderComponent();
      await waitFor(() => {
         expect(screen.getByText(/Aceitar/i)).toBeInTheDocument();
         expect(screen.getByText(/Rejeitar/i)).toBeInTheDocument();
      });
    });

    it('NÃO renderiza botões de ação para acordos ATIVOS', async () => {
      setupMocksForRole('Motorista', [acordoAtivoMotorista]);
      await renderComponent();
      await waitFor(() => {
         expect(screen.queryByText(/Aceitar/i)).not.toBeInTheDocument();
         expect(screen.queryByText(/Rejeitar/i)).not.toBeInTheDocument();
      });
    });

    it('chama approveAgreement ao clicar em "Aceitar"', async () => {
      setupMocksForRole('Motorista', [acordoPendenteMotorista]);
      AgreementsService.approveAgreement.mockResolvedValue({});
      await renderComponent();

      await waitFor(() => {
         expect(screen.getByText(/Aceitar/i)).toBeInTheDocument();
      });

      await act(async () => { fireEvent.click(screen.getByText(/Aceitar/i)); });

      expect(AgreementsService.approveAgreement).toHaveBeenCalledWith(acordoPendenteMotorista.id);
    });

    it('chama rejectAgreement ao clicar em "Rejeitar"', async () => {
      setupMocksForRole('Motorista', [acordoPendenteMotorista]);
      AgreementsService.rejectAgreement.mockResolvedValue({});
      await renderComponent();

      await waitFor(() => {
         expect(screen.getByText(/Rejeitar/i)).toBeInTheDocument();
      });

      await act(async () => { fireEvent.click(screen.getByText(/Rejeitar/i)); });

      expect(AgreementsService.rejectAgreement).toHaveBeenCalledWith(acordoPendenteMotorista.id);
    });

    it('exibe mensagem de estado vazio quando não há pedidos', async () => {
        setupMocksForRole('Motorista', []);
        await renderComponent();
        await waitFor(() => {
            expect(screen.getByText('Ainda não tens pedidos de passageiros nas tuas rotas.')).toBeInTheDocument();
        });
    });
  });

  describe('Estilos dos Badges', () => {
    it('badge PENDENTE tem classes de cor amber (bg-amber/10)', async () => {
      setupMocksForRole('Passageiro', [acordoPendentePassageiro]);
      await renderComponent();
      await waitFor(() => {
         const badge = screen.getByTestId('badge-estado');
         expect(badge.className).toContain('bg-amber/10');
      });
    });

    it('badge ATIVO tem classes de cor emerald (bg-emerald/10)', async () => {
      setupMocksForRole('Passageiro', [acordoAtivoPassageiro]);
      await renderComponent();
      await waitFor(() => {
         const badge = screen.getByTestId('badge-estado');
         expect(badge.className).toContain('bg-emerald/10');
      });
    });
  });
});
