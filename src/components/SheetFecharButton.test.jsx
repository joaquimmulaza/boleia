import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SheetFecharButton from './SheetFecharButton';

describe('SheetFecharButton', () => {
  it('é um botão shadcn com nome acessível Fechar', () => {
    render(<SheetFecharButton onClick={() => {}} data-testid="sheet-fechar" />);
    const btn = screen.getByRole('button', { name: 'Fechar' });
    expect(btn).toHaveAttribute('data-testid', 'sheet-fechar');
    expect(btn.className).toMatch(/inline-flex/);
  });

  it('chama onClick ao clicar', () => {
    const onClose = vi.fn();
    render(<SheetFecharButton onClick={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
