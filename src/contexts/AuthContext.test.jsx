import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';

import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  }
}));

const TestComponent = () => {
  const { user, loading, tipoPerfil, profile } = useAuth();
  
  if (loading) return <div data-testid="loading">A carregar...</div>;
  
  return (
    <div>
      <div data-testid="user">{user ? user.id : 'no-user'}</div>
      <div data-testid="tipoPerfil">{tipoPerfil || 'no-perfil'}</div>
      <div data-testid="onboarding">{profile?.onboarding_completed ? 'done' : 'pending'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockImplementation(() => Promise.resolve({
      data: { id: 'user-123', tipo_perfil: 'Motorista', onboarding_completed: false },
      error: null,
    }));
  });

  it('Estado inicial loading=true antes da sessão ser resolvida', async () => {
    let resolveSession;
    supabase.auth.getSession.mockReturnValue(new Promise(resolve => {
        resolveSession = resolve;
    }));
    supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    resolveSession({ data: { session: null }, error: null });
  });

  it('user=null quando não há sessão activa', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('user, tipoPerfil normalizado e profile quando há sessão activa', async () => {
    const mockSession = {
      user: {
        id: 'user-123',
        user_metadata: {
          tipo_perfil: 'motorista'
        }
      }
    };
    supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('user-123');
    expect(screen.getByTestId('tipoPerfil')).toHaveTextContent('Motorista');
    expect(supabase.from).toHaveBeenCalledWith('perfis');
  });

  it('onAuthStateChange actualiza o user ao disparar SIGNED_IN', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    
    let authChangeListener;
    supabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authChangeListener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    const mockSession = {
      user: {
        id: 'user-456',
        user_metadata: {
          tipo_perfil: 'passageiro'
        }
      }
    };
    
    mockSingle.mockResolvedValueOnce({
      data: { id: 'user-456', tipo_perfil: 'Passageiro', onboarding_completed: false },
      error: null,
    });

    await act(async () => {
      await authChangeListener('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('user-456');
    });
    expect(screen.getByTestId('tipoPerfil')).toHaveTextContent('Passageiro');
  });

  it('unsubscribe chamado ao desmontar o AuthProvider', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const unsubscribeMock = vi.fn();
    supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: unsubscribeMock } } });

    const { unmount } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('useAuth() fora do provider lança erro com mensagem clara', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth deve ser usado dentro de um AuthProvider');
    
    consoleSpy.mockRestore();
  });
});
