import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ProfileBankDetails from './ProfileBankDetails';
import { supabase } from '../lib/supabase';
import * as ProfileService from '../services/ProfileService';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../services/ProfileService', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

describe('ProfileBankDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'mot-1', email: 'm@exemplo.com' } },
      error: null,
    });
  });

  const renderPage = async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/perfil/dados-bancarios']}>
          <ProfileBankDetails />
        </MemoryRouter>,
      );
    });
  };

  it('empty state com CTA Adicionar dados bancários', async () => {
    ProfileService.getProfile.mockResolvedValue({
      id: 'mot-1',
      tipo_perfil: 'Motorista',
      iban: '',
      iban_titular: '',
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Ainda sem dados bancários')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Adicionar dados bancários/i })).toBeInTheDocument();
  });

  it('com dados mostra titular e IBAN em leitura', async () => {
    ProfileService.getProfile.mockResolvedValue({
      id: 'mot-1',
      tipo_perfil: 'Motorista',
      iban: 'AO06004000000000000000000',
      iban_titular: 'Carlos Motorista',
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Carlos Motorista')).toBeInTheDocument();
    });
    expect(screen.getByText('AO06004000000000000000000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument();
  });
});
