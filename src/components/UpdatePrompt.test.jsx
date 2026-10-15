import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import UpdatePrompt from './UpdatePrompt';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { flickSheetDown, flushMotion, mockSheetMotion } from '../test/sheetPointer';
import {
  DISMISS_STORAGE_KEY,
  resetServiceWorkerUpdateChecksForTests,
} from '../utils/pwaUpdateVersion';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}));

const BUILD_B = 'abc111deploy222';
const BUILD_A = 'def333deploy444';

/**
 * @param {string} buildId
 */
function createWaitingWorker(buildId) {
  return {
    scriptURL: 'https://app.test/sw.js',
    postMessage(message, transfer) {
      if (message?.type === 'GET_BUILD_ID' && transfer?.[0]) {
        transfer[0].postMessage({ type: 'BUILD_ID', buildId });
      }
    },
  };
}

describe('UpdatePrompt Component (PWA)', () => {
  let updateServiceWorkerMock;
  let setNeedRefreshMock;
  /** @type {() => void | undefined} */
  let onNeedRefreshCallback;
  /** @type {((swUrl: string, r: unknown) => void) | undefined} */
  let onRegisteredSWCallback;
  /** @type {{ update: ReturnType<typeof vi.fn> } | null} */
  let registrationMock;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetServiceWorkerUpdateChecksForTests();
    updateServiceWorkerMock = vi.fn();
    setNeedRefreshMock = vi.fn();
    onNeedRefreshCallback = undefined;
    onRegisteredSWCallback = undefined;

    registrationMock = {
      update: vi.fn(),
      waiting: createWaitingWorker(BUILD_B),
    };

    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      onRegisteredSWCallback = options.onRegisteredSW;
      return {
        needRefresh: [false, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve(registrationMock),
      },
    });
  });

  afterEach(() => {
    resetServiceWorkerUpdateChecksForTests();
  });

  it('Estado 1: não deve renderizar o prompt se needRefresh for false', () => {
    render(<UpdatePrompt />);

    expect(screen.queryByText(/Atualização disponível/i)).not.toBeInTheDocument();
  });

  it('Estado 2: deve renderizar o prompt com as mensagens e botões se needRefresh for true', async () => {
    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      onRegisteredSWCallback = options.onRegisteredSW;
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
    const panel = screen.getByTestId('update-prompt-panel');
    expect(panel.className).toMatch(/rounded-\[34px\]/);
    expect(panel.querySelector('.pb-sheet')).toBeTruthy();
    expect(screen.getByTestId('sheet-drag-handle')).toBeInTheDocument();
  });

  it('Interação: deve chamar updateServiceWorker(true) ao clicar em "Atualizar agora"', async () => {
    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      onRegisteredSWCallback = options.onRegisteredSW;
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

  it('Interação: «Mais tarde» persiste dismiss do build id e esconde o prompt no remount', async () => {
    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      onRegisteredSWCallback = options.onRegisteredSW;
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
    expect(localStorage.getItem(DISMISS_STORAGE_KEY)).toBe(BUILD_B);

    unmount();

    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      onRegisteredSWCallback = options.onRegisteredSW;
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

  it('fecha ao deslizar para baixo e memoriza o build id', async () => {
    const restoreMotion = mockSheetMotion();
    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      onRegisteredSWCallback = options.onRegisteredSW;
      return {
        needRefresh: [true, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    render(<UpdatePrompt />);
    onNeedRefreshCallback?.();

    flickSheetDown(await screen.findByRole('heading', { name: /Atualização disponível/i }));
    await flushMotion();

    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
    expect(localStorage.getItem(DISMISS_STORAGE_KEY)).toBe(BUILD_B);
    expect(updateServiceWorkerMock).not.toHaveBeenCalled();
    restoreMotion();
  });

  it('mostra de novo quando o build id em waiting muda (dismiss build A, waiting build B)', async () => {
    localStorage.setItem(DISMISS_STORAGE_KEY, BUILD_A);
    registrationMock.waiting = createWaitingWorker(BUILD_B);

    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      onRegisteredSWCallback = options.onRegisteredSW;
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

  it('ignora dismiss legado em scriptURL (/sw.js) e volta a mostrar o prompt', async () => {
    localStorage.setItem('pwa-update-dismissed', '/sw.js');

    useRegisterSW.mockImplementation((options = {}) => {
      onNeedRefreshCallback = options.onNeedRefresh;
      onRegisteredSWCallback = options.onRegisteredSW;
      return {
        needRefresh: [true, setNeedRefreshMock],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
      };
    });

    render(<UpdatePrompt />);
    onNeedRefreshCallback?.();

    expect(await screen.findByText(/Atualização disponível/i)).toBeInTheDocument();
    expect(localStorage.getItem('pwa-update-dismissed')).toBeNull();
  });

  it('visibilitychange para visible chama registration.update()', async () => {
    render(<UpdatePrompt />);
    await act(async () => {
      onRegisteredSWCallback?.('/sw.js', registrationMock);
    });

    expect(registrationMock.update).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(registrationMock.update).toHaveBeenCalledTimes(1);
  });
});
