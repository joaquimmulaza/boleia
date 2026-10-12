import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Profile from './Profile';
import { supabase } from '../lib/supabase';
import * as ProfileService from '../services/ProfileService';
import {
  PROFILE_DISCARD_EDITS,
  PROFILE_EDIT,
  PROFILE_PERSONAL_DATA,
  PROFILE_RECEIPTS,
  PROFILE_SAVE_CHANGES,
  PROFILE_SAVE_ERROR,
  PROFILE_SAVE_SUCCESS,
  PROFILE_SIGN_OUT,
  PROFILE_TITLE,
  PROFILE_PHONE_INVALID,
} from '../utils/profileCopy';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../services/ProfileService', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../components/PushNotificationsToggle', () => ({
  default: () => <div data-testid="push-notifications-toggle-stub" />,
}));

vi.mock('../components/InstallAppCard', () => ({
  default: () => <div data-testid="install-app-stub" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const baseProfile = {
  id: 'user-123',
  nome_completo: 'Manuel Pedro',
  telefone: '+244923123456',
  tipo_perfil: 'Passageiro',
  avatar_url: null,
  iban: '',
  iban_titular: '',
};

describe('Profile v2', () => {
  const renderProfile = async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/perfil']}>
          <Profile />
        </MemoryRouter>,
      );
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'teste@exemplo.com', user_metadata: {} } },
      error: null,
    });
    supabase.auth.signOut.mockResolvedValue({ error: null });
    ProfileService.getProfile.mockResolvedValue({ ...baseProfile });
    ProfileService.updateProfile.mockResolvedValue({});
  });

  it('mostra título, tipo Passageiro e dados pessoais só leitura', async () => {
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: PROFILE_TITLE })).toBeInTheDocument();
    });
    expect(screen.getByText('Passageiro')).toBeInTheDocument();
    expect(screen.getAllByText('Manuel Pedro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+244 923 123 456')).toBeInTheDocument();
    expect(screen.getByText('teste@exemplo.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PROFILE_EDIT })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: PROFILE_SAVE_CHANGES })).not.toBeInTheDocument();
  });

  it('passageiro não vê Recebimentos nem Dados bancários', async () => {
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByText(PROFILE_PERSONAL_DATA)).toBeInTheDocument();
    });
    expect(screen.queryByText(PROFILE_RECEIPTS)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dados bancários/i)).not.toBeInTheDocument();
  });

  it('motorista vê Recebimentos e link para dados bancários', async () => {
    ProfileService.getProfile.mockResolvedValue({
      ...baseProfile,
      nome_completo: 'Carlos Motorista',
      tipo_perfil: 'Motorista',
    });
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByText('Motorista')).toBeInTheDocument();
    });
    expect(screen.getByText(PROFILE_RECEIPTS)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dados bancários/i })).toHaveAttribute(
      'href',
      '/perfil/dados-bancarios',
    );
    expect(screen.getByRole('link', { name: PROFILE_RECEIPTS })).toHaveAttribute(
      'href',
      '/perfil/recebimentos',
    );
  });

  it('modo edição: descartar repõe valores e guardar com sucesso', async () => {
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: PROFILE_EDIT })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: PROFILE_EDIT }));
    const nameInput = screen.getByLabelText(/Nome completo/i);
    fireEvent.change(nameInput, { target: { value: 'Nome Novo' } });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_DISCARD_EDITS }));

    expect(screen.getAllByText('Manuel Pedro').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: PROFILE_SAVE_CHANGES })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: PROFILE_EDIT }));
    fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: 'Nome Guardado' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: PROFILE_SAVE_CHANGES }));
    });

    expect(ProfileService.updateProfile).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ nome_completo: 'Nome Guardado' }),
    );
    await waitFor(() => {
      expect(screen.getByText(PROFILE_SAVE_SUCCESS)).toBeInTheDocument();
    });
  });

  it('telefone inválido bloqueia guardar', async () => {
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: PROFILE_EDIT })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_EDIT }));
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_SAVE_CHANGES }));
    expect(screen.getByText(PROFILE_PHONE_INVALID)).toBeInTheDocument();
    expect(ProfileService.updateProfile).not.toHaveBeenCalled();
  });

  it('erro ao guardar mantém formulário e mostra copy de erro', async () => {
    ProfileService.updateProfile.mockRejectedValue(new Error('network'));
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: PROFILE_EDIT })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_EDIT }));
    fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: 'Falha' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: PROFILE_SAVE_CHANGES }));
    });
    expect(await screen.findByText(PROFILE_SAVE_ERROR)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Falha')).toBeInTheDocument();
  });

  it('terminar sessão chama signOut sem modal', async () => {
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: PROFILE_SIGN_OUT })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_SIGN_OUT }));
    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
