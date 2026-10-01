import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstallAppInstructionsModal from './InstallAppInstructionsModal';

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
});
