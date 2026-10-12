import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SheetFecharButton from './SheetFecharButton';

describe('SheetFecharButton', () => {
  it('é botão X shadcn com aria-label Fechar (sem texto visível)', () => {
    render(<SheetFecharButton onClick={() => {}} data-testid="sheet-fechar" />);
    const btn = screen.getByRole('button', { name: 'Fechar' });
    expect(btn).toHaveAttribute('data-testid', 'sheet-fechar');
    expect(btn.className).toMatch(/inline-flex/);
    expect(screen.queryByText('Fechar')).not.toBeInTheDocument();
  });

  it('chama onClick ao clicar', () => {
    const onClose = vi.fn();
    render(<SheetFecharButton onClick={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
