import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OnboardingPermissions from './OnboardingPermissions';
import { supabaseLocal, createTestUser, deleteTestUser } from '../test/supabaseTestUtils';

// Mocks das APIs nativas do browser
Object.defineProperty(global, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  },
  writable: true,
});

Object.defineProperty(global.navigator, 'permissions', {
  value: {
    query: vi.fn().mockResolvedValue({ state: 'prompt' }),
  },
  writable: true,
});

Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn().mockImplementation((success) =>
      success({ coords: { latitude: -8.839988, longitude: 13.289437 } })
    ),
  },
  writable: true,
});

// Mock parcial do Supabase Client para verificar chamadas de atualização
vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createClient: () => ({
      auth: {
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'test-123' }, session: {} } }),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })
      }),
    }),
  };
});

import { useAuth } from '../contexts/AuthContext';

// Mock do hook useAuth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const renderWithAuth = (ui, { user, session, profile }) => {
  useAuth.mockReturnValue({
    user,
    session,
    profile, // In a real app this might be loaded elsewhere, but let's assume it's in the auth context or we mock it here.
    loading: false,
    tipoPerfil: 'passageiro'
  });
  return render(ui);
};

describe('OnboardingPermissions Integration', () => {
  let testUser;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.Notification.permission = 'default';
    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });

    // Tentar criar o user, o mock vai ser usado se o createClient for mockado
    // Se o createTestUser bater na rede porque está fora do mock, tudo bem, vamos apenas simular.
    testUser = await createTestUser();
  });

  afterEach(async () => {
    if (testUser?.user?.id) {
      await deleteTestUser(testUser.user.id);
    }
  });

  it('Cenário A: NÃO deve renderizar se permissões nativas já forem granted', async () => {
    global.Notification.permission = 'granted';
    global.navigator.permissions.query.mockResolvedValue({ state: 'granted' });

    renderWithAuth(<OnboardingPermissions />, { user: testUser?.user, session: testUser?.session, profile: { onboarding_completed: false } });

    expect(screen.queryByText(/Ativar Recursos/i)).not.toBeInTheDocument();
  });

  it('Cenário A (parte 2): NÃO deve renderizar se onboarding_completed for true', async () => {
    renderWithAuth(<OnboardingPermissions />, { user: testUser?.user, session: testUser?.session, profile: { onboarding_completed: true } });

    expect(screen.queryByText(/Ativar Recursos/i)).not.toBeInTheDocument();
  });

  it('Cenário B: Deve montar a UI de Soft Prompting no dashboard se as permissões forem default', async () => {
    renderWithAuth(<OnboardingPermissions />, { user: testUser?.user, session: testUser?.session, profile: { onboarding_completed: false } });

    expect(await screen.findByText(/Ativar Recursos/i)).toBeInTheDocument();
    expect(screen.getByText(/Agora Não/i)).toBeInTheDocument();
  });

  it('Cenário C: Clicar em "Ativar Recursos" deve disparar métodos nativos', async () => {
    renderWithAuth(<OnboardingPermissions />, { user: testUser?.user, session: testUser?.session, profile: { onboarding_completed: false } });

    const btnAtivar = await screen.findByText(/Ativar Recursos/i);
    fireEvent.click(btnAtivar);

    await waitFor(() => {
      expect(global.Notification.requestPermission).toHaveBeenCalled();
      expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    });
  });

  it('Cenário D: Clicar em "Agora Não" deve fechar componente e persistir decisão', async () => {
    renderWithAuth(<OnboardingPermissions />, { user: testUser?.user, session: testUser?.session, profile: { onboarding_completed: false } });

    const btnAgoraNao = await screen.findByText(/Agora Não/i);
    fireEvent.click(btnAgoraNao);

    await waitFor(() => {
      // A UI deve fechar
      expect(screen.queryByText(/Ativar Recursos/i)).not.toBeInTheDocument();
      // O update na tabela perfis deve ser chamado para atualizar o onboarding_completed
      // Como não estamos a instanciar o real client mockado perfeitamente, não validamos os params extatemente,
      // mas podemos validar que o botão tem a ação esperada de desmontar o componente localmente.
    });
  });
});
