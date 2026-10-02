import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OnboardingPermissions from './OnboardingPermissions';
import { markPermissionsEligible } from '../utils/permissionsPrompt';
import { flickSheetDown, flushMotion, mockSheetMotion } from '../test/sheetPointer';

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
    getCurrentPosition: vi.fn(),
  },
  writable: true,
});

vi.mock('../contexts/AuthContext', () => {
  const profile = { onboarding_completed: false };
  return {
    useAuth: () => ({
      user: { id: 'user-1' },
      profile,
      refreshProfile: vi.fn(),
    }),
  };
});

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    subscribe: vi.fn(),
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

describe('OnboardingPermissions — adiamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('não mostra o modal antes de uma acção relevante', async () => {
    render(<OnboardingPermissions />);

    await waitFor(() => {
      expect(screen.queryByText(/Ativar Recursos/i)).not.toBeInTheDocument();
    });
  });

  it('mostra o modal depois de markPermissionsEligible', async () => {
    render(<OnboardingPermissions />);

    markPermissionsEligible();

    expect(await screen.findByText(/Ativar Recursos/i)).toBeInTheDocument();
    expect(screen.getByText(/ponto de recolha combinado/i)).toBeInTheDocument();
    expect(screen.queryByText(/boleias perto de ti/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('sheet-drag-handle')).toBeInTheDocument();
    const panel = screen.getByTestId('onboarding-permissions-panel');
    expect(panel.firstElementChild?.className).toMatch(/pb-sheet/);
  });

  it('fecha ao deslizar para baixo', async () => {
    const restoreMotion = mockSheetMotion();
    render(<OnboardingPermissions />);
    markPermissionsEligible();

    flickSheetDown(await screen.findByRole('heading', { name: /Ative os Recursos Essenciais/i }));
    await flushMotion();

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Ative os Recursos Essenciais/i })).not.toBeInTheDocument();
    });
    restoreMotion();
  });
});
