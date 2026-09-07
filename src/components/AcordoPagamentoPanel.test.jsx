import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AcordoPagamentoPanel from './AcordoPagamentoPanel.jsx';

vi.mock('../services/PaymentService', () => ({
  getPlatformIban: vi.fn(() => 'AO06004000000000000000000'),
  uploadComprovativo: vi.fn(),
}));

import { getPlatformIban, uploadComprovativo } from '../services/PaymentService';

describe('AcordoPagamentoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatformIban).mockReturnValue('AO06004000000000000000000');
  });

  it('mostra valor do acordo e IBAN da plataforma', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 43000,
          estado: 'pendente_pagamento',
        }}
      />,
    );
    expect(screen.getByTestId('acordo-pagamento-panel')).toBeInTheDocument();
    expect(screen.getByText(/43[\s\u00a0]000/)).toBeInTheDocument();
    expect(screen.getByText(/AO06004000000000000000000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar comprovativo/i })).toBeInTheDocument();
  });

  it('sem IBAN: empty state e botão desactivado', () => {
    vi.mocked(getPlatformIban).mockReturnValue(null);

    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 43000,
          estado: 'pendente_pagamento',
        }}
      />,
    );

    expect(screen.getByTestId('iban-nao-configurado')).toBeInTheDocument();
    expect(screen.getByText(/Transferência indisponível/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Enviar comprovativo/i });
    expect(btn).toBeDisabled();
  });

  it('mostra preview do ficheiro e acção Substituir comprovativo', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 43000,
          estado: 'comprovativo_enviado',
          comprovativo_path: 'uid/pag-1/recibo-setembro.pdf',
        }}
      />,
    );

    expect(screen.getByTestId('comprovativo-preview')).toHaveTextContent('recibo-setembro.pdf');
    expect(screen.getByRole('button', { name: /Substituir comprovativo/i })).toBeInTheDocument();
  });

  it('não mostra upload quando pagamento já em custódia', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-2',
          valor_kz: 43000,
          estado: 'em_custodia',
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: /Enviar comprovativo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Substituir comprovativo/i })).not.toBeInTheDocument();
  });

  it('upload chama serviço quando IBAN configurado', async () => {
    vi.mocked(uploadComprovativo).mockResolvedValue('pag-1');

    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 43000,
          estado: 'pendente_pagamento',
        }}
      />,
    );

    const input = screen.getByTestId('comprovativo-input');
    const file = new File(['x'], 'comprovativo.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(uploadComprovativo).toHaveBeenCalledWith('pag-1', file);
  });
});
