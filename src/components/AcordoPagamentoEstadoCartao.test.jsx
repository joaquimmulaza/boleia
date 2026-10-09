import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AcordoPagamentoEstadoCartao from './AcordoPagamentoEstadoCartao.jsx';

describe('AcordoPagamentoEstadoCartao', () => {
  it('S1 mostra corpo informativo', () => {
    render(
      <AcordoPagamentoEstadoCartao
        variant="S1"
        corpo="O pagamento não foi confirmado a tempo. O lugar não chegou a ficar activo e não tens nada a pagar."
      />,
    );
    expect(screen.getByTestId('acordo-pagamento-estado-cartao')).toHaveAttribute('data-variant', 'S1');
    expect(screen.getByText(/não tens nada a pagar/)).toBeInTheDocument();
  });

  it('S3 mostra chip Pagamento cancelado', () => {
    render(
      <AcordoPagamentoEstadoCartao
        variant="S3"
        corpo="O pagamento de 16 000 Kz deste acordo foi cancelado."
        chipPagamento="Pagamento cancelado"
      />,
    );
    expect(screen.getByTestId('cartao-estado-chip-pagamento')).toHaveTextContent('Pagamento cancelado');
  });

  it('S2 pode montar slot de upload', () => {
    render(
      <AcordoPagamentoEstadoCartao
        variant="S2"
        corpo="Ainda tens de pagar 8 000 Kz."
        mostrarUploadNoCartao
        uploadSlot={<button type="button">Enviar comprovativo</button>}
      />,
    );
    expect(screen.getByTestId('cartao-estado-upload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar comprovativo/i })).toBeInTheDocument();
  });
});
