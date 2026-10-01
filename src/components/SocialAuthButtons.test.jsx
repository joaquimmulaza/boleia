import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SocialAuthButtons from './SocialAuthButtons';

describe('SocialAuthButtons', () => {
  it('mostra Continuar com os quatro providers', () => {
    render(<SocialAuthButtons onProvider={() => {}} />);
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar com Apple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar com Facebook' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar com LinkedIn' })).toBeInTheDocument();
  });

  it('enquanto liga ao Google desactiva os outros e muda o rótulo', () => {
    const onProvider = vi.fn();
    render(<SocialAuthButtons pendingProvider="google" onProvider={onProvider} />);
    const google = screen.getByRole('button', { name: 'A ligar ao Google...' });
    expect(google).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continuar com Apple' })).toBeDisabled();
    fireEvent.click(google);
    expect(onProvider).not.toHaveBeenCalled();
  });

  it('chama o provider uma vez por clique', () => {
    const onProvider = vi.fn();
    render(<SocialAuthButtons onProvider={onProvider} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar com Facebook' }));
    expect(onProvider).toHaveBeenCalledTimes(1);
    expect(onProvider).toHaveBeenCalledWith('facebook');
  });
});
