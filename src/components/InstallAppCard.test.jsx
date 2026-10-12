import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstallAppCard from './InstallAppCard';
import { usePwaInstall } from '../hooks/usePwaInstall';
import {
  PROFILE_APP_IPHONE_HINT,
  PROFILE_APP_OPEN_IN_SAFARI,
} from '../utils/profileCopy';

vi.mock('../hooks/usePwaInstall');

const baseMock = {
  canInstallNative: false,
  isInstalled: false,
  isInApp: false,
  needsInstructions: true,
  promptInstall: vi.fn(),
};

describe('InstallAppCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('oculta a secção quando a app já está instalada (standalone)', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      isInstalled: true,
      platform: 'android',
      isIosSafari: false,
    });

    render(<InstallAppCard />);
    expect(screen.queryByTestId('install-app-card')).not.toBeInTheDocument();
  });

  it('Safari iOS: só a dica Partilhar, sem abrir no Safari', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      isIosSafari: true,
    });

    render(<InstallAppCard />);
    expect(screen.getByTestId('install-ios-safari-hint')).toHaveTextContent(PROFILE_APP_IPHONE_HINT);
    expect(screen.queryByText(PROFILE_APP_OPEN_IN_SAFARI)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Instalar app/i })).not.toBeInTheDocument();
  });

  it('Chrome iOS: abrir no Safari primeiro, depois dica Partilhar', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      isIosSafari: false,
    });

    render(<InstallAppCard />);
    const block = screen.getByTestId('install-ios-non-safari-hints');
    expect(block).toHaveTextContent(PROFILE_APP_OPEN_IN_SAFARI);
    expect(block).toHaveTextContent(PROFILE_APP_IPHONE_HINT);
    expect(screen.queryByRole('button', { name: /Instalar app/i })).not.toBeInTheDocument();
  });

  it('Firefox iOS: abrir no Safari primeiro, depois dica Partilhar', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      isIosSafari: false,
      isInApp: false,
    });

    render(<InstallAppCard />);
    expect(screen.getByText(PROFILE_APP_OPEN_IN_SAFARI)).toBeInTheDocument();
    expect(screen.getByText(PROFILE_APP_IPHONE_HINT)).toBeInTheDocument();
  });

  it('browser dentro de uma app (iOS): abrir no Safari e dica Partilhar, sem botão', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      isIosSafari: false,
      isInApp: true,
    });

    render(<InstallAppCard />);
    expect(screen.getByTestId('install-ios-non-safari-hints')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Instalar app/i })).not.toBeInTheDocument();
  });

  it('Android Chrome: modal genérico sem passos Safari iOS', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'android',
      isIosSafari: false,
    });

    render(<InstallAppCard />);
    fireEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(screen.getByTestId('install-instructions-overlay')).toBeInTheDocument();
    expect(screen.queryByText(/No iPhone, segue estes passos no Safari/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Toca em Partilhar/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No teu browser, procura a opção/i)).toBeInTheDocument();
  });

  it('desktop: modal genérico sem passos Safari iOS', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'desktop',
      isIosSafari: false,
    });

    render(<InstallAppCard />);
    fireEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(screen.getByTestId('install-instructions-overlay')).toBeInTheDocument();
    expect(screen.queryByText(/No iPhone, segue estes passos no Safari/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No teu browser, procura a opção/i)).toBeInTheDocument();
  });

  it('mostra CTA Instalar app com beforeinstallprompt', () => {
    const promptInstall = vi.fn().mockResolvedValue('accepted');
    usePwaInstall.mockReturnValue({
      ...baseMock,
      canInstallNative: true,
      platform: 'android',
      isIosSafari: false,
      promptInstall,
    });

    render(<InstallAppCard />);
    fireEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(promptInstall).toHaveBeenCalled();
  });
});
