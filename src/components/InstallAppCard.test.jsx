import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InstallAppCard from './InstallAppCard';
import { usePwaInstall } from '../hooks/usePwaInstall';
import {
  PROFILE_APP_IPHONE_HINT,
  PROFILE_APP_IOS_OPEN_SAFARI_THEN_SHARE,
  PROFILE_APP_IOS_SHARE_ONLY,
  PROFILE_APP_COPY_LINK,
  PROFILE_APP_LINK_COPIED,
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
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('oculta a secção quando a app já está instalada (standalone)', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      isInstalled: true,
      platform: 'android',
      iosInstall: null,
    });

    render(<InstallAppCard />);
    expect(screen.queryByTestId('install-app-card')).not.toBeInTheDocument();
  });

  it('Safari iOS: instruções actuais do Safari', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      iosInstall: { mode: 'safari', showCopyLink: false },
    });

    render(<InstallAppCard />);
    expect(screen.getByTestId('install-ios-safari-hint')).toHaveTextContent(PROFILE_APP_IPHONE_HINT);
    expect(screen.queryByRole('button', { name: PROFILE_APP_COPY_LINK })).not.toBeInTheDocument();
  });

  it('in-app iOS: copy v1.3, Copiar link e toast Link copiado.', async () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      isInApp: true,
      iosInstall: { mode: 'open_safari_then_share', showCopyLink: true },
    });

    render(<InstallAppCard />);
    expect(screen.getByTestId('install-ios-non-safari-hints')).toHaveTextContent(
      PROFILE_APP_IOS_OPEN_SAFARI_THEN_SHARE,
    );
    fireEvent.click(screen.getByRole('button', { name: PROFILE_APP_COPY_LINK }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('install-link-copied-toast')).toHaveTextContent(PROFILE_APP_LINK_COPIED);
    });
  });

  it('CriOS abaixo do 16.4: abrir no Safari depois Partilhar', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      iosInstall: { mode: 'open_safari_then_share', showCopyLink: false },
    });

    render(<InstallAppCard />);
    expect(screen.getByText(PROFILE_APP_IOS_OPEN_SAFARI_THEN_SHARE)).toBeInTheDocument();
  });

  it('CriOS no iOS 16.4 ou acima: só Partilhar', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      iosInstall: { mode: 'share_only', showCopyLink: false },
    });

    render(<InstallAppCard />);
    expect(screen.getByText(PROFILE_APP_IOS_SHARE_ONLY)).toBeInTheDocument();
  });

  it('EdgiOS no iOS 16.4+: só Partilhar', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      iosInstall: { mode: 'share_only', showCopyLink: false },
    });

    render(<InstallAppCard />);
    expect(screen.getByTestId('install-ios-non-safari-hints')).toHaveTextContent(PROFILE_APP_IOS_SHARE_ONLY);
  });

  it('FxiOS: abrir no Safari depois Partilhar', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'ios',
      iosInstall: { mode: 'open_safari_then_share', showCopyLink: false },
    });

    render(<InstallAppCard />);
    expect(screen.getByText(PROFILE_APP_IOS_OPEN_SAFARI_THEN_SHARE)).toBeInTheDocument();
  });

  it('Android Chrome: modal genérico sem passos Safari iOS', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'android',
      iosInstall: null,
    });

    render(<InstallAppCard />);
    fireEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(screen.getByTestId('install-instructions-overlay')).toBeInTheDocument();
    expect(screen.queryByText(/No iPhone, segue estes passos no Safari/i)).not.toBeInTheDocument();
    expect(screen.queryByText(PROFILE_APP_IOS_SHARE_ONLY)).not.toBeInTheDocument();
    expect(screen.getByText(/No teu browser, procura a opção/i)).toBeInTheDocument();
  });

  it('desktop: modal genérico sem passos Safari iOS', () => {
    usePwaInstall.mockReturnValue({
      ...baseMock,
      platform: 'desktop',
      iosInstall: null,
    });

    render(<InstallAppCard />);
    fireEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(screen.queryByText(PROFILE_APP_IOS_OPEN_SAFARI_THEN_SHARE)).not.toBeInTheDocument();
    expect(screen.getByText(/No teu browser, procura a opção/i)).toBeInTheDocument();
  });

  it('mostra CTA Instalar app com beforeinstallprompt', () => {
    const promptInstall = vi.fn().mockResolvedValue('accepted');
    usePwaInstall.mockReturnValue({
      ...baseMock,
      canInstallNative: true,
      platform: 'android',
      iosInstall: null,
      promptInstall,
    });

    render(<InstallAppCard />);
    fireEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(promptInstall).toHaveBeenCalled();
  });
});
