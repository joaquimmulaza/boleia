import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstallAppCard from './InstallAppCard';
import { usePwaInstall } from '../hooks/usePwaInstall';

vi.mock('../hooks/usePwaInstall');

describe('InstallAppCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('oculta a secção quando a app já está instalada (standalone)', () => {
    usePwaInstall.mockReturnValue({
      canInstallNative: false,
      isInstalled: true,
      platform: 'android',
      isInApp: false,
      needsInstructions: false,
      promptInstall: vi.fn(),
    });

    render(<InstallAppCard />);
    expect(screen.queryByTestId('install-app-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('install-app-installed')).not.toBeInTheDocument();
  });

  it('mostra CTA Instalar app com beforeinstallprompt', () => {
    const promptInstall = vi.fn().mockResolvedValue('accepted');
    usePwaInstall.mockReturnValue({
      canInstallNative: true,
      isInstalled: false,
      platform: 'android',
      isInApp: false,
      needsInstructions: false,
      promptInstall,
    });

    render(<InstallAppCard />);
    fireEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(promptInstall).toHaveBeenCalled();
  });

  it('no iPhone mostra instrução Safari em vez do botão', () => {
    usePwaInstall.mockReturnValue({
      canInstallNative: false,
      isInstalled: false,
      platform: 'ios',
      isInApp: false,
      needsInstructions: true,
      promptInstall: vi.fn(),
    });

    render(<InstallAppCard />);
    expect(screen.getByText(/No iPhone, no Safari/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Instalar app/i })).not.toBeInTheDocument();
  });
});
