import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OnboardingPermissions from './OnboardingPermissions';
import { markPermissionsEligible } from '../utils/permissionsPrompt';

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
      success({ coords: { latitude: -8.839988, longitude: 13.289437 } }),
    ),
  },
  writable: true,
});

const mockSubscribe = vi.fn().mockResolvedValue({ success: true });
const mockRefreshProfile = vi.fn().mockResolvedValue(undefined);

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    subscribe: mockSubscribe,
    isSupported: true,
  }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

import { useAuth } from '../contexts/AuthContext';

/**
 * @param {object} [overrides]
 */
function renderWithAuth(overrides = {}) {
  useAuth.mockReturnValue({
    user: { id: 'user-test-1' },
    session: { access_token: 'jwt-test' },
    profile: { onboarding_completed: false },
    loading: false,
    tipoPerfil: 'Passageiro',
    refreshProfile: mockRefreshProfile,
    ...overrides,
  });
  return render(<OnboardingPermissions />);
}

describe('OnboardingPermissions Integration (PWA push — fluxo 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    global.Notification.permission = 'default';
    global.navigator.permissions.query.mockResolvedValue({ state: 'prompt' });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('Cenário A: NÃO renderiza se permissões nativas já forem granted', async () => {
    global.Notification.permission = 'granted';
    global.navigator.permissions.query.mockResolvedValue({ state: 'granted' });
    markPermissionsEligible();

    renderWithAuth();

    await waitFor(() => {
      expect(screen.queryByText(/Ativar Recursos/i)).not.toBeInTheDocument();
    });
  });

  it('Cenário A (parte 2): NÃO renderiza se onboarding_completed for true', async () => {
    markPermissionsEligible();
    renderWithAuth({ profile: { onboarding_completed: true } });

    await waitFor(() => {
      expect(screen.queryByText(/Ativar Recursos/i)).not.toBeInTheDocument();
    });
  });

  it('Cenário B: monta soft prompt após acção relevante (markPermissionsEligible)', async () => {
    renderWithAuth();
    markPermissionsEligible();

    expect(await screen.findByText(/Ativar Recursos/i)).toBeInTheDocument();
    expect(screen.getByText(/Agora Não/i)).toBeInTheDocument();
  });

  it('Cenário C: "Ativar Recursos" dispara nativos + push subscribe', async () => {
    renderWithAuth();
    markPermissionsEligible();

    fireEvent.click(await screen.findByText(/Ativar Recursos/i));

    await waitFor(() => {
      expect(global.Notification.requestPermission).toHaveBeenCalled();
      expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalledWith('user-test-1');
    });
  });

  it('Cenário D: "Agora Não" fecha o modal e persiste onboarding_completed', async () => {
    renderWithAuth();
    markPermissionsEligible();

    fireEvent.click(await screen.findByText(/Agora Não/i));

    await waitFor(() => {
      expect(screen.queryByText(/Ativar Recursos/i)).not.toBeInTheDocument();
      expect(mockRefreshProfile).toHaveBeenCalled();
    });
  });
});
