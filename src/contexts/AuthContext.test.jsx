import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// The implementation does not exist yet, but we import it to test it.
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

// Mock do Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    }
  }
}));

// Componente de teste para consumir o useAuth
const TestComponent = () => {
  const { session, user, loading, tipoPerfil } = useAuth();
  
  if (loading) return <div data-testid="loading">A carregar...</div>;
  
  return (
    <div>
      <div data-testid="user">{user ? user.id : 'no-user'}</div>
      <div data-testid="tipoPerfil">{tipoPerfil || 'no-perfil'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    
    // Resolve promise para evitar pending handle
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

  it('user e tipoPerfil correctos quando há sessão activa', async () => {
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
    expect(screen.getByTestId('tipoPerfil')).toHaveTextContent('motorista');
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

    // Simulando o SIGNED_IN
    const mockSession = {
      user: {
        id: 'user-456',
        user_metadata: {
          tipo_perfil: 'passageiro'
        }
      }
    };
    
    authChangeListener('SIGNED_IN', mockSession);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('user-456');
    });
    expect(screen.getByTestId('tipoPerfil')).toHaveTextContent('passageiro');
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
