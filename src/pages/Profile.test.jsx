import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Profile from './Profile';
import { supabase } from '../lib/supabase';
import * as ProfileService from '../services/ProfileService';
import * as AccountService from '../services/AccountService';
import {
  PROFILE_DISCARD_EDITS,
  PROFILE_EDIT,
  PROFILE_PERSONAL_DATA,
  PROFILE_RECEIPTS,
  PROFILE_RECEIPTS_COMING_SOON,
  PROFILE_SAVE_CHANGES,
  PROFILE_SAVE_ERROR,
  PROFILE_SAVE_SUCCESS,
  PROFILE_SIGN_OUT,
  PROFILE_TITLE,
  PROFILE_PHONE_INVALID,
  PROFILE_DELETE_ACCOUNT,
  PROFILE_LOGIN_METHODS_TITLE,
} from '../utils/profileCopy';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
      getUserIdentities: vi.fn(),
    },
  },
}));

vi.mock('../services/ProfileService', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../services/AccountService', () => ({
  deleteOwnAccount: vi.fn(),
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
    supabase.auth.getUserIdentities.mockResolvedValue({ data: { identities: [] }, error: null });
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

  it('motorista vê Recebimentos desactivado (sem link) e link para dados bancários', async () => {
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
    expect(screen.getByText(PROFILE_RECEIPTS_COMING_SOON)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dados bancários/i })).toHaveAttribute(
      'href',
      '/perfil/dados-bancarios',
    );
    expect(screen.queryByRole('link', { name: PROFILE_RECEIPTS })).not.toBeInTheDocument();
    const recebimentosRow = screen.getByText(PROFILE_RECEIPTS).closest('[aria-disabled="true"]');
    expect(recebimentosRow).toBeTruthy();
    expect(recebimentosRow).toHaveAttribute('aria-disabled', 'true');
    expect(recebimentosRow).toHaveTextContent(PROFILE_RECEIPTS_COMING_SOON);
    fireEvent.click(recebimentosRow);
    expect(screen.getByRole('heading', { name: PROFILE_TITLE })).toBeInTheDocument();
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

  it('terminar sessão repõe busy se signOut falhar', async () => {
    supabase.auth.signOut.mockRejectedValueOnce(new Error('offline'));
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: PROFILE_SIGN_OUT })).toBeInTheDocument();
    });
    const signOutBtn = screen.getByRole('button', { name: PROFILE_SIGN_OUT });
    await act(async () => {
      fireEvent.click(signOutBtn);
    });
    await waitFor(() => {
      expect(signOutBtn).not.toBeDisabled();
    });
  });

  it('mostra métodos de início de sessão e Apagar conta', async () => {
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByText(PROFILE_LOGIN_METHODS_TITLE)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: PROFILE_DELETE_ACCOUNT })).toBeInTheDocument();
  });

  it('Apagar conta abre modal de confirmação', async () => {
    await renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: PROFILE_DELETE_ACCOUNT })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_DELETE_ACCOUNT }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Apagar a conta\?/i)).toBeInTheDocument();
    AccountService.deleteOwnAccount.mockResolvedValue(undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Apagar a conta$/i }));
    });
    expect(AccountService.deleteOwnAccount).toHaveBeenCalled();
  });
});
