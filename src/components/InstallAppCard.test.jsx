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

  it('mostra estado instalada sem CTA de instalação', () => {
    usePwaInstall.mockReturnValue({
      canInstallNative: false,
      isInstalled: true,
      platform: 'android',
      isInApp: false,
      needsInstructions: false,
      promptInstall: vi.fn(),
    });

    render(<InstallAppCard />);
    expect(screen.getByTestId('install-app-installed')).toBeInTheDocument();
    expect(screen.getByText(/App no ecrã/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar ao ecrã/i })).not.toBeInTheDocument();
  });

  it('mostra CTA nativo Adicionar ao ecrã', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Adicionar ao ecrã/i }));
    expect(promptInstall).toHaveBeenCalled();
  });

  it('mostra Ver como adicionar no iOS', () => {
    usePwaInstall.mockReturnValue({
      canInstallNative: false,
      isInstalled: false,
      platform: 'ios',
      isInApp: false,
      needsInstructions: true,
      promptInstall: vi.fn(),
    });

    render(<InstallAppCard />);
    fireEvent.click(screen.getByRole('button', { name: /Ver como adicionar/i }));
    expect(screen.getByRole('dialog', { name: /Adicionar ao ecrã/i })).toBeInTheDocument();
  });
});
