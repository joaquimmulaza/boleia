import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginMethodsSection from './LoginMethodsSection';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUserIdentities: vi.fn(),
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
    },
  },
}));

vi.mock('../utils/appOrigin', () => ({
  getOAuthRedirectUrl: () => 'https://boleia-cyan.vercel.app/auth',
}));

import { supabase } from '../lib/supabase';

describe('LoginMethodsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra providers ligados e permite associar os restantes', async () => {
    supabase.auth.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: 'email', id: 'e1' }, { provider: 'google', id: 'g1' }] },
      error: null,
    });
    supabase.auth.linkIdentity.mockResolvedValue({ data: {}, error: null });

    render(<LoginMethodsSection />);

    expect(await screen.findByText('Email e palavra-passe')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desassociar' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Associar' })[0]);

    await waitFor(() => {
      expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
        provider: 'facebook',
        options: { redirectTo: 'https://boleia-cyan.vercel.app/auth' },
      });
    });
    expect(supabase.auth.linkIdentity).not.toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'apple' }),
    );
  });

  it('não desassocia quando só há uma identidade social', async () => {
    supabase.auth.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: 'google', id: 'g1' }] },
      error: null,
    });

    render(<LoginMethodsSection />);
    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desassociar' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Ligado').length).toBeGreaterThan(0);
  });

  it('desassocia Google quando existe outra forma de entrar', async () => {
    supabase.auth.getUserIdentities.mockResolvedValue({
      data: {
        identities: [
          { provider: 'email', id: 'e1' },
          { provider: 'google', id: 'g1' },
        ],
      },
      error: null,
    });
    supabase.auth.unlinkIdentity.mockResolvedValue({ error: null });

    render(<LoginMethodsSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Desassociar' }));

    await waitFor(() => {
      expect(supabase.auth.unlinkIdentity).toHaveBeenCalledWith({ provider: 'google', id: 'g1' });
    });
    expect(await screen.findByText('Método desassociado.')).toBeInTheDocument();
  });

  it('mostra erro amigável se a associação manual estiver desligada', async () => {
    supabase.auth.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: 'email', id: 'e1' }] },
      error: null,
    });
    supabase.auth.linkIdentity.mockResolvedValue({
      error: { message: 'Manual linking is disabled' },
    });

    render(<LoginMethodsSection />);
    const buttons = await screen.findAllByRole('button', { name: 'Associar' });
    fireEvent.click(buttons[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A associação de contas ainda não está activa neste ambiente.',
    );
  });
});
