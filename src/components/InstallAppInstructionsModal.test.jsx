import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import InstallAppInstructionsModal from './InstallAppInstructionsModal';
import { flickSheetDown, flushMotion, mockSheetMotion } from '../test/sheetPointer';

describe('InstallAppInstructionsModal', () => {
  it('não renderiza quando isOpen é false', () => {
    render(<InstallAppInstructionsModal isOpen={false} onClose={vi.fn()} platform="ios" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mostra passos iOS Safari', () => {
    render(<InstallAppInstructionsModal isOpen onClose={vi.fn()} platform="ios" />);
    expect(screen.getByRole('dialog', { name: /Adicionar ao ecrã/i })).toBeInTheDocument();
    expect(screen.getByText(/Partilhar/i)).toBeInTheDocument();
    expect(screen.getByText(/Adicionar ao ecrã inicial/i)).toBeInTheDocument();
  });

  it('avisa in-app browser', () => {
    render(
      <InstallAppInstructionsModal isOpen onClose={vi.fn()} platform="ios" isInAppBrowser />
    );
    expect(screen.getByText(/Safari ou Chrome/i)).toBeInTheDocument();
  });

  it('chama onClose ao clicar Fechar', () => {
    const onClose = vi.fn();
    render(<InstallAppInstructionsModal isOpen onClose={onClose} platform="ios" />);
    fireEvent.click(screen.getByRole('button', { name: /Fechar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('deixa folga interior por baixo do botão, fora do painel com scroll', () => {
    render(<InstallAppInstructionsModal isOpen onClose={vi.fn()} platform="ios" />);
    const panel = screen.getByTestId('install-instructions-panel');
    expect(panel.className).toMatch(/overflow-y-auto/);
    expect(panel.className).not.toMatch(/\bpb-sheet\b/);
    expect(panel.firstElementChild?.className).toMatch(/pb-sheet/);
  });

  it('fecha ao deslizar para baixo no título', async () => {
    const restoreMotion = mockSheetMotion();
    const onClose = vi.fn();
    render(<InstallAppInstructionsModal isOpen onClose={onClose} platform="ios" />);

    flickSheetDown(screen.getByRole('heading', { name: /Adicionar ao ecrã/i }));
    await flushMotion();

    expect(onClose).toHaveBeenCalledTimes(1);
    restoreMotion();
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
