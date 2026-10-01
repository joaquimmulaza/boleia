import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InstallAppPrompt from './InstallAppPrompt';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useAuth } from '../contexts/AuthContext';
import { INSTALL_DISMISS_STORAGE_KEY } from '../utils/pwaInstall';
import { ONBOARDING_PERMISSIONS_CLOSED_EVENT } from '../utils/permissionsPrompt';

vi.mock('../hooks/usePwaInstall');
vi.mock('../contexts/AuthContext');

describe('InstallAppPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'prompt' }),
      },
    });

    useAuth.mockReturnValue({
      profile: { onboarding_completed: true },
    });

    usePwaInstall.mockReturnValue({
      canInstallNative: true,
      isInstalled: false,
      platform: 'android',
      isInApp: false,
      needsInstructions: false,
      promptInstall: vi.fn().mockResolvedValue('accepted'),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não renderiza se já instalada', async () => {
    usePwaInstall.mockReturnValue({
      canInstallNative: false,
      isInstalled: true,
      platform: 'android',
      isInApp: false,
      needsInstructions: false,
      promptInstall: vi.fn(),
    });

    render(<InstallAppPrompt />);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText(/Tens a app no ecrã/i)).not.toBeInTheDocument();
  });

  it('aparece após delay quando onboarding concluído', async () => {
    render(<InstallAppPrompt />);

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(2100);
    });

    expect(screen.getByText(/Tens a app no ecrã/i)).toBeInTheDocument();
  });

  it('Agora não persiste dismiss', async () => {
    render(<InstallAppPrompt />);

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(2100);
    });

    fireEvent.click(screen.getByRole('button', { name: /Agora não/i }));

    expect(localStorage.getItem(INSTALL_DISMISS_STORAGE_KEY)).toBe('1');

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.queryByRole('dialog', { name: /Tens a app no ecrã/i })).not.toBeInTheDocument();
  });

  it('reage ao evento de fecho do onboarding', async () => {
    useAuth.mockReturnValue({ profile: { onboarding_completed: false } });

    render(<InstallAppPrompt />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('dialog', { name: /Tens a app no ecrã/i })).not.toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event(ONBOARDING_PERMISSIONS_CLOSED_EVENT));
      await Promise.resolve();
      vi.advanceTimersByTime(2100);
    });

    expect(screen.getByRole('dialog', { name: /Tens a app no ecrã/i })).toBeInTheDocument();
  });
});
