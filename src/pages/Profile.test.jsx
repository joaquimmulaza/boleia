import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import Profile from './Profile';
import { supabase } from '../lib/supabase';
import * as ProfileService from '../services/ProfileService';

// Mock das libs
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock('../services/ProfileService', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  getVehicle: vi.fn(),
  updateVehicle: vi.fn(),
}));

describe('Profile Component', () => {

  const renderComponent = async () => {
      await act(async () => { render(<Profile />); });
  }

  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'teste@exemplo.com' } },
      error: null,
    });

    ProfileService.getProfile.mockResolvedValue({
        id: 'user-123',
        nome_completo: 'Manuel Pedro',
        telefone: '+244923123456',
        tipo_perfil: 'Passageiro',
        avatar_url: null
    });

    ProfileService.getVehicle.mockResolvedValue(null);
  });

  describe('Renderização Inicial e Visualização (Passageiro)', () => {
    it('renderiza título do perfil e campos de formulário pré-preenchidos', async () => {
      await renderComponent();
      await waitFor(() => {
         expect(screen.getByText('O Meu Perfil')).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('Manuel Pedro')).toBeInTheDocument();
      expect(screen.getByDisplayValue('923123456')).toBeInTheDocument();
      expect(screen.getByDisplayValue('teste@exemplo.com')).toBeInTheDocument();
    });

    it('renderiza o botão Guardar Alterações e NÃO os campos de Veículo', async () => {
        await renderComponent();
        await waitFor(() => {
           expect(screen.getByText('Guardar Alterações')).toBeInTheDocument();
        });
        expect(screen.queryByLabelText(/Marca\/Modelo/i)).not.toBeInTheDocument();
    });
  });

  describe('Edição de Perfil (Motorista)', () => {
      beforeEach(() => {
        ProfileService.getProfile.mockResolvedValue({
            id: 'user-123',
            nome_completo: 'Carlos Motorista',
            telefone: '+244923000000',
            tipo_perfil: 'Motorista',
            avatar_url: null
        });
        ProfileService.getVehicle.mockResolvedValue({
            id: 'veh-1',
            marca_modelo: 'Toyota Hiace',
            matricula: 'LD-12-34-AO',
            capacidade_total: 5,
            vagas_passageiros: 4,
        });
      });

      it('mostra os campos de veículo para o Motorista', async () => {
        await renderComponent();
        await waitFor(() => {
            expect(screen.getByDisplayValue('Toyota Hiace')).toBeInTheDocument();
            expect(screen.getByDisplayValue('LD-12-34-AO')).toBeInTheDocument();
            expect(screen.getByDisplayValue('5')).toBeInTheDocument();
        });
      });

      it('atualiza o perfil e o veículo ao submeter formulário', async () => {
        ProfileService.updateProfile.mockResolvedValue({});
        ProfileService.updateVehicle.mockResolvedValue({});

        await renderComponent();
        await waitFor(() => {
            expect(screen.getByDisplayValue('Carlos Motorista')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByDisplayValue('Carlos Motorista'), { target: { value: 'Carlos Silva' } });
        fireEvent.change(screen.getByDisplayValue('Toyota Hiace'), { target: { value: 'Hyundai I10' } });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Guardar Alterações/i }));
        });

        expect(ProfileService.updateProfile).toHaveBeenCalledWith('user-123', expect.objectContaining({
            nome_completo: 'Carlos Silva',
        }));

        expect(ProfileService.updateVehicle).toHaveBeenCalledWith('user-123', 'veh-1', expect.objectContaining({
            marca_modelo: 'Hyundai I10'
        }));

        await waitFor(() => {
            expect(screen.getByText('Perfil actualizado com sucesso!')).toBeInTheDocument();
        });
      });

      it('sem dados bancários mostra empty state real sem campos Titular/IBAN', async () => {
        ProfileService.getProfile.mockResolvedValue({
          id: 'user-123',
          nome_completo: 'Carlos Motorista',
          telefone: '+244923000000',
          tipo_perfil: 'Motorista',
          avatar_url: null,
          iban: '',
          iban_titular: '',
        });

        await renderComponent();

        await waitFor(() => {
          expect(screen.getByText('Ainda sem dados bancários')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /Adicionar dados bancários/i })).toBeInTheDocument();
        expect(screen.getByText(/Adiciona o titular e o IBAN para receberes os pagamentos das tuas boleias/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/Titular da conta/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^IBAN$/i)).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/Nome completo do titular/i)).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/AO06/i)).not.toBeInTheDocument();
      });

      it('CTA Adicionar dados bancários revela formulário bancário', async () => {
        ProfileService.getProfile.mockResolvedValue({
          id: 'user-123',
          nome_completo: 'Carlos Motorista',
          telefone: '+244923000000',
          tipo_perfil: 'Motorista',
          avatar_url: null,
          iban: '',
          iban_titular: '',
        });

        await renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Ainda sem dados bancários')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Adicionar dados bancários/i }));

        expect(screen.getByLabelText(/Titular da conta/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^IBAN$/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Nome completo do titular/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/AO06/i)).toBeInTheDocument();
      });

      it('com IBAN preenchido mostra campos bancários directamente', async () => {
        ProfileService.getProfile.mockResolvedValue({
          id: 'user-123',
          nome_completo: 'Carlos Motorista',
          telefone: '+244923000000',
          tipo_perfil: 'Motorista',
          avatar_url: null,
          iban: 'AO06004000000000000000000',
          iban_titular: 'Carlos Motorista',
        });

        await renderComponent();

        await waitFor(() => {
          expect(screen.getByDisplayValue('AO06004000000000000000000')).toBeInTheDocument();
        });
        expect(screen.queryByText('Ainda sem dados bancários')).not.toBeInTheDocument();
      });

      it('sticky Guardar tem espaço acima do CTA', async () => {
        await renderComponent();
        await waitFor(() => {
          expect(screen.getByTestId('profile-sticky-save')).toBeInTheDocument();
        });
        expect(screen.getByTestId('profile-sticky-spacer')).toBeInTheDocument();
      });
  });
});
