import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';
import * as AgreementsService from '../services/AgreementsService';
import MyAgreements from './MyAgreements';

// Mocks globais

vi.mock('../hooks/useNotifications', () => ({
  default: () => ({
    addNotification: vi.fn(),
  })
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../services/AgreementsService', () => ({
  getAgreementsForUser: vi.fn(),
  approveAgreement: vi.fn(),
  rejectAgreement: vi.fn(),
}));

describe('Página MyAgreements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = async () => {
    render(
      <MemoryRouter>
        <MyAgreements />
      </MemoryRouter>
    );
  };

  const setupMocksForRole = (role, acordosData = []) => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: `user-${role}`, user_metadata: { tipo_perfil: role } } },
      error: null,
    });
    AgreementsService.getAgreementsForUser.mockResolvedValue(acordosData);
  };

  const acordoPendentePassageiro = {
     id: 'acordo-1',
     estado: 'Pendente',
     routes: { origin_name: 'Viana', destination_name: 'Mutamba', monthly_price_per_seat: 10000 },
     contraparte: { nome_completo: 'Motorista 1' }
  };

  const acordoAtivoPassageiro = {
     id: 'acordo-2',
     estado: 'Ativo',
     routes: { origin_name: 'Luanda', destination_name: 'Talatona', monthly_price_per_seat: 15000 },
     contraparte: { nome_completo: 'Motorista 2' },
     veiculo: { marca_modelo: 'Toyota Hilux 2022', matricula: 'LD-12-34-AB' }
  };

  const acordoPendenteMotorista = {
     id: 'acordo-3',
     estado: 'Pendente',
     routes: { origin_name: 'Benfica', destination_name: 'Maculusso', monthly_price_per_seat: 5000 },
     contraparte: { nome_completo: 'Passageiro Teste' }
  };

  const acordoAtivoMotorista = {
     id: 'acordo-4',
     estado: 'Ativo',
     routes: { origin_name: 'Kilamba', destination_name: 'Baixa', monthly_price_per_seat: 12000 },
     contraparte: { nome_completo: 'Outro Passageiro' }
  };

  describe('Renderização Comum', () => {
    it('renderiza o componente sem erros', async () => {
      setupMocksForRole('Passageiro');
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

// --- Testes para o Modal e Kebab Menu ---
describe('MyAgreements - Modal and Context Menu interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAtivoAcordoPassageiro = {
    id: 99,
    estado: 'ativo',
    routes: {
      origin_name: 'Luanda',
      destination_name: 'Talatona',
      departure_time: '08:00',
      monthly_price_per_seat: 15000
    },
    contraparte: { nome_completo: 'Motorista Real', telefone: '+244999999999' },
    veiculo: { marca_modelo: 'Toyota Real', matricula: 'XYZ' }
  };

  const mockAtivoAcordoMotorista = {
    id: 100,
    estado: 'ativo',
    routes: {
      origin_name: 'Luanda',
      destination_name: 'Talatona',
      departure_time: '08:00',
      monthly_price_per_seat: 15000
    },
    contraparte: { nome_completo: 'Passageiro Real', telefone: '+244888888888' }
  };

  it('Passenger should see Ver Detalhes and open Modal with dynamic data', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'pass-1', user_metadata: { tipo_perfil: 'Passageiro' } } },
      error: null
    });
    AgreementsService.getAgreementsForUser.mockResolvedValue([mockAtivoAcordoPassageiro]);

    render(
      <MemoryRouter>
        <MyAgreements />
      </MemoryRouter>
    );

    // Ver nome dinâmico no card
    const nameOnCard = await screen.findByText('Motorista Real');
    expect(nameOnCard).toBeInTheDocument();

    const btnDetalhes = screen.getByText(/Ver Detalhes/i);
    expect(btnDetalhes).toBeInTheDocument();

    fireEvent.click(btnDetalhes);

    expect(screen.getByText('Detalhes do Acordo')).toBeInTheDocument();

    // Verifica dados do veículo e da contraparte no Modal
    expect(screen.getByText('Veículo')).toBeInTheDocument();
    expect(screen.getByText('Toyota Real')).toBeInTheDocument();
    expect(screen.getByText('XYZ')).toBeInTheDocument();
    expect(screen.getByText('+244999999999')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fechar'));

    await waitFor(() => {
      expect(screen.queryByText('Detalhes do Acordo')).not.toBeInTheDocument();
    });
  });

  it('Driver should see Kebab menu on Active Agreement and open Modal with dynamic data', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'driver-1', user_metadata: { tipo_perfil: 'Motorista' } } },
      error: null
    });

    AgreementsService.getAgreementsForUser.mockResolvedValue([mockAtivoAcordoMotorista]);

    render(
      <MemoryRouter>
        <MyAgreements />
      </MemoryRouter>
    );

    // Ver nome dinâmico no card
    const nameOnCard = await screen.findByText('Passageiro Real');
    expect(nameOnCard).toBeInTheDocument();

    // Menu dropdown
    const kebabButton = screen.getByRole('button', { name: /Opções/i });
    expect(kebabButton).toBeInTheDocument();

    fireEvent.click(kebabButton);

    expect(screen.getByText(/Reportar Problema/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancelar Acordo/i)).toBeInTheDocument();

    // Abre Modal como motorista
    const btnDetalhes = screen.getByText(/Ver Detalhes/i);
    fireEvent.click(btnDetalhes);

    expect(screen.getByText('Detalhes do Acordo')).toBeInTheDocument();
    expect(screen.getAllByText('Passageiro Real').length).toBeGreaterThan(0);
    expect(screen.getByText('+244888888888')).toBeInTheDocument();

    // Motorista não vê veículo do passageiro
    expect(screen.queryByText('Veículo')).not.toBeInTheDocument();
  });
});
