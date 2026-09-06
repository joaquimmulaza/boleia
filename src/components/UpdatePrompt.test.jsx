import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpdatePrompt from './UpdatePrompt';
import { useRegisterSW } from 'virtual:pwa-register/react';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}));

const WAITING_URL = 'https://app.test/sw.js?v=build-42';
const DISMISS_STORAGE_KEY = 'pwa-update-dismissed';

describe('UpdatePrompt Component (PWA)', () => {
  let updateServiceWorkerMock;
  let setNeedRefreshMock;
  /** @type {() => void | undefined} */
  let onNeedRefreshCallback;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    updateServiceWorkerMock = vi.fn();
    setNeedRefreshMock = vi.fn();
    onNeedRefreshCallback = undefined;

    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      return {
        needRefresh: [false, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          waiting: { scriptURL: WAITING_URL },
        }),
      },
    });
  });

  it('Estado 1: não deve renderizar o prompt se needRefresh for false', () => {
    render(<UpdatePrompt />);

    expect(screen.queryByText(/Atualização disponível/i)).not.toBeInTheDocument();
  });

  it('Estado 2: deve renderizar o prompt com as mensagens e botões se needRefresh for true', async () => {
    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      return {
        needRefresh: [true, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    render(<UpdatePrompt />);
    onNeedRefreshCallback?.();

    expect(await screen.findByText(/Atualização disponível/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar agora/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mais tarde/i })).toBeInTheDocument();
  });

  it('Interação: deve chamar updateServiceWorker(true) ao clicar em "Atualizar agora"', async () => {
    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      return {
        needRefresh: [true, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    render(<UpdatePrompt />);
    onNeedRefreshCallback?.();

    fireEvent.click(await screen.findByRole('button', { name: /Atualizar agora/i }));

    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
  });

  it('Interação: «Mais tarde» persiste dismiss da versão e esconde o prompt no remount', async () => {
    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      return {
        needRefresh: [true, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    const { unmount } = render(<UpdatePrompt />);
    onNeedRefreshCallback?.();

    fireEvent.click(await screen.findByRole('button', { name: /Mais tarde/i }));

    expect(updateServiceWorkerMock).not.toHaveBeenCalled();
    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
    expect(localStorage.getItem(DISMISS_STORAGE_KEY)).toBe(WAITING_URL);

    unmount();

    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      return {
        needRefresh: [true, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    render(<UpdatePrompt />);
    onNeedRefreshCallback?.();

    await waitFor(() => {
      expect(screen.queryByText(/Atualização disponível/i)).not.toBeInTheDocument();
    });
  });

  it('mostra de novo quando a versão à espera muda', async () => {
    localStorage.setItem(DISMISS_STORAGE_KEY, 'https://app.test/sw.js?v=build-41');

    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      return {
        needRefresh: [true, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    render(<UpdatePrompt />);
    onNeedRefreshCallback?.();

    expect(await screen.findByText(/Atualização disponível/i)).toBeInTheDocument();
  });
});
