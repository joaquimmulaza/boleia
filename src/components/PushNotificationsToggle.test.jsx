import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import PushNotificationsToggle from './PushNotificationsToggle';
import {
  PUSH_PROFILE_BLOCKED_HELP,
  PUSH_PROFILE_ERROR,
  PUSH_PROFILE_ERROR_DISABLE,
  PUSH_PROFILE_IPHONE_HELPER,
  PUSH_PROFILE_STATE_ACTIVATING,
  PUSH_PROFILE_STATE_BLOCKED,
  PUSH_PROFILE_STATE_OFF,
  PUSH_PROFILE_STATE_ON,
  PUSH_PROFILE_UNSUPPORTED,
} from '../utils/pushProfileCopy';

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

/** @type {{ isSupported: boolean, permission: string, isSubscribed: boolean, initialLoading: boolean, actionLoading: boolean, loading: boolean, subscribe: typeof mockSubscribe, unsubscribe: typeof mockUnsubscribe }} */
let pushHookState = {
  isSupported: true,
  permission: 'granted',
  isSubscribed: true,
  initialLoading: false,
  actionLoading: false,
  loading: false,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
};

/** @type {() => void} */
let rerenderToggle = () => {};

let pwaState = {
  platform: 'android',
  isInstalled: true,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-push-1' } }),
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    ...pushHookState,
    get loading() {
      return pushHookState.initialLoading || pushHookState.actionLoading;
    },
    get initialLoading() {
      return pushHookState.initialLoading;
    },
    get actionLoading() {
      return pushHookState.actionLoading;
    },
  }),
}));

vi.mock('../hooks/usePwaInstall', () => ({
  usePwaInstall: () => pwaState,
}));

function renderToggle() {
  const result = render(<PushNotificationsToggle />);
  rerenderToggle = () => {
    result.rerender(<PushNotificationsToggle />);
  };
  return result;
}

function simulateHookLoadingDuringAction(kind) {
  if (kind === 'enable') {
    mockSubscribe.mockImplementation(() => {
      pushHookState.actionLoading = true;
      rerenderToggle();
      return new Promise(() => {});
    });
  } else {
    mockUnsubscribe.mockImplementation(() => {
      pushHookState.actionLoading = true;
      rerenderToggle();
      return new Promise(() => {});
    });
  }
}

describe('PushNotificationsToggle — 6 estados /perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushHookState = {
      isSupported: true,
      permission: 'granted',
      isSubscribed: true,
      initialLoading: false,
      actionLoading: false,
      loading: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
    };
    rerenderToggle = () => {};
    pwaState = { platform: 'android', isInstalled: true };
  });

  it('estado 1 · Activado: switch ligado e copy de avisos activos', () => {
    renderToggle();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('push-profile-status-line')).toHaveTextContent(PUSH_PROFILE_STATE_ON);
  });

  it('estado 2 · Desactivado: switch desligado e copy sem avisos', () => {
    pushHookState = { ...pushHookState, isSubscribed: false, permission: 'granted' };
    renderToggle();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('push-profile-status-line')).toHaveTextContent(PUSH_PROFILE_STATE_OFF);
  });

  it('estado 3 · A activar: mostra «A activar…» e switch em loading', () => {
    pushHookState = { ...pushHookState, isSubscribed: false, permission: 'default' };
    mockSubscribe.mockImplementation(
      () => new Promise(() => {}),
    );

    renderToggle();
    fireEvent.click(screen.getByRole('switch'));

    expect(screen.getByTestId('push-profile-status-line')).toHaveTextContent(PUSH_PROFILE_STATE_ACTIVATING);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-busy', 'true');
  });

  it('estado 4 · Bloqueado: switch desactivado e painel com ajuda do navegador', () => {
    pushHookState = { ...pushHookState, permission: 'denied', isSubscribed: false };
    renderToggle();
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('push-profile-status-bloqueado')).toHaveTextContent(PUSH_PROFILE_STATE_BLOCKED);
    expect(screen.getByTestId('push-profile-status-bloqueado')).toHaveTextContent(PUSH_PROFILE_BLOCKED_HELP);
  });

  it('estado 5 · Erro: mensagem inline após falha na activação', async () => {
    pushHookState = { ...pushHookState, isSubscribed: false, permission: 'default' };
    mockSubscribe.mockResolvedValue({ error: 'falhou' });

    renderToggle();
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(screen.getByTestId('push-profile-status-erro')).toHaveTextContent(PUSH_PROFILE_ERROR);
    });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  describe('hook loading durante acção (review B3)', () => {
    it('ligar: com actionLoading no hook mantém «A activar…» e spinner', () => {
      pushHookState = {
        ...pushHookState,
        isSubscribed: false,
        permission: 'default',
      };
      simulateHookLoadingDuringAction('enable');

      renderToggle();
      fireEvent.click(screen.getByRole('switch'));

      expect(screen.getByTestId('push-profile-status-line')).toHaveTextContent(PUSH_PROFILE_STATE_ACTIVATING);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-busy', 'true');
    });

    it('desligar: com actionLoading no hook mantém switch ON, spinner e sem copy OFF', () => {
      simulateHookLoadingDuringAction('disable');

      renderToggle();
      fireEvent.click(screen.getByRole('switch'));

      expect(screen.getByRole('switch')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      expect(screen.queryByText(PUSH_PROFILE_STATE_OFF)).not.toBeInTheDocument();
      expect(screen.queryByText(PUSH_PROFILE_STATE_ACTIVATING)).not.toBeInTheDocument();
    });
  });

  describe('desactivar (review B1)', () => {
    it('ao desligar: spinner sem linha «A activar…» e switch mantém-se ligado', () => {
      mockUnsubscribe.mockImplementation(() => new Promise(() => {}));

      renderToggle();
      fireEvent.click(screen.getByRole('switch'));

      expect(screen.getByRole('switch')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      expect(screen.queryByTestId('push-profile-status-line')).not.toBeInTheDocument();
      expect(screen.queryByText(PUSH_PROFILE_STATE_ACTIVATING)).not.toBeInTheDocument();
    });

    it('falha ao desligar: copy de desactivação e switch continua ligado', async () => {
      mockUnsubscribe.mockResolvedValue({ error: 'falhou desactivar' });

      renderToggle();
      fireEvent.click(screen.getByRole('switch'));

      await waitFor(() => {
        expect(screen.getByTestId('push-profile-status-erro')).toHaveTextContent(PUSH_PROFILE_ERROR_DISABLE);
      });
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('push-profile-status-erro')).not.toHaveTextContent(PUSH_PROFILE_ERROR);
    });
  });

  it('estado 6 · Sem suporte: navegador sem push (iPhone mostra linha de ajuda)', () => {
    pushHookState = { ...pushHookState, isSupported: false, isSubscribed: false, permission: 'default' };
    pwaState = { platform: 'ios', isInstalled: false };

    renderToggle();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
    const panel = screen.getByTestId('push-profile-status-sem-suporte');
    expect(panel).toHaveTextContent(PUSH_PROFILE_UNSUPPORTED);
    expect(panel).toHaveTextContent(PUSH_PROFILE_IPHONE_HELPER);
  });
});
