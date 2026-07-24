import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdatePrompt from './UpdatePrompt';
import { useRegisterSW } from 'virtual:pwa-register/react';
import React from 'react';

// Mock the virtual module
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}));

describe('UpdatePrompt Component (PWA)', () => {
  let updateServiceWorkerMock;
  let setNeedRefreshMock;

  beforeEach(() => {
    vi.clearAllMocks();
    updateServiceWorkerMock = vi.fn();
    setNeedRefreshMock = vi.fn();
    
    // Default mock setup
    useRegisterSW.mockReturnValue({
      needRefresh: [false, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    });
  });

  it('Estado 1: não deve renderizar o prompt se needRefresh for false', () => {
    render(<UpdatePrompt />);
    
    expect(screen.queryByText(/Atualização disponível/i)).not.toBeInTheDocument();
  });

  it('Estado 2: deve renderizar o prompt com as mensagens e botões se needRefresh for true', () => {
    useRegisterSW.mockReturnValue({
      needRefresh: [true, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    });

    render(<UpdatePrompt />);
    
    expect(screen.getByText(/Atualização disponível/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar agora/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mais tarde/i })).toBeInTheDocument();
  });

  it('Interação: deve chamar updateServiceWorker(true) ao clicar em "Atualizar agora"', () => {
    useRegisterSW.mockReturnValue({
      needRefresh: [true, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    });

    render(<UpdatePrompt />);
    
    const updateButton = screen.getByRole('button', { name: /Atualizar agora/i });
    fireEvent.click(updateButton);

    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
  });

  it('Interação: deve fechar localmente sem disparar a atualização ao clicar em "Mais tarde"', () => {
    useRegisterSW.mockReturnValue({
      needRefresh: [true, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    });

    render(<UpdatePrompt />);
    
    const laterButton = screen.getByRole('button', { name: /Mais tarde/i });
    fireEvent.click(laterButton);

    expect(updateServiceWorkerMock).not.toHaveBeenCalled();
    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
  });
});
