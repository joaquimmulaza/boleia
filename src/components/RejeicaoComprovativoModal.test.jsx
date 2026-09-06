import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RejeicaoComprovativoModal from './RejeicaoComprovativoModal.jsx';

describe('RejeicaoComprovativoModal', () => {
  it('não renderiza quando fechado', () => {
    render(
      <RejeicaoComprovativoModal
        isOpen={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('rejeicao-comprovativo-modal')).not.toBeInTheDocument();
  });

  it('submete motivo trimado ou null', () => {
    const onConfirm = vi.fn();
    render(
      <RejeicaoComprovativoModal isOpen onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('rejeicao-motivo-input'), {
      target: { value: '  Valor incorrecto  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar rejeição/i }));

    expect(onConfirm).toHaveBeenCalledWith('Valor incorrecto');
  });

  it('submete null quando motivo vazio', () => {
    const onConfirm = vi.fn();
    render(
      <RejeicaoComprovativoModal isOpen onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirmar rejeição/i }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('cancelar chama onCancel', () => {
    const onCancel = vi.fn();
    render(
      <RejeicaoComprovativoModal isOpen onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Voltar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
