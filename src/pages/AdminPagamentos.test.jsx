import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminPagamentos from './AdminPagamentos.jsx';

vi.mock('../services/PaymentService', () => ({
  listPagamentosPendentesValidacao: vi.fn(),
  adminValidatePayment: vi.fn(),
  getComprovativoSignedUrl: vi.fn(),
}));

import {
  listPagamentosPendentesValidacao,
  adminValidatePayment,
  getComprovativoSignedUrl,
} from '../services/PaymentService';

describe('AdminPagamentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeitar abre modal em vez de window.prompt', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([
      {
        id: 'pag-1',
        valor_kz: 43000,
        valor_payout_liquido_kz: 38700,
        comprovativo_path: 'uid/pag-1/recibo.pdf',
        perfis: { nome_completo: 'Maria' },
      },
    ]);
    adminValidatePayment.mockResolvedValue('pag-1');

    render(<AdminPagamentos />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-fila-pagamentos')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Rejeitar$/i }));
    expect(screen.getByTestId('rejeicao-comprovativo-modal')).toBeInTheDocument();
    expect(window.prompt).toBeUndefined();

    fireEvent.change(screen.getByTestId('rejeicao-motivo-input'), {
      target: { value: 'Valor incorrecto' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar rejeição/i }));

    await waitFor(() => {
      expect(adminValidatePayment).toHaveBeenCalledWith('pag-1', false, 'Valor incorrecto');
    });
  });

  it('mostra nome do comprovativo e obtém URL assinada', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([
      {
        id: 'pag-2',
        valor_kz: 43000,
        valor_payout_liquido_kz: 38700,
        comprovativo_path: 'uid/pag-2/foto.png',
        perfis: { nome_completo: 'João' },
      },
    ]);
    getComprovativoSignedUrl.mockResolvedValue('https://signed.example/foto.png');

    render(<AdminPagamentos />);

    await waitFor(() => {
      expect(screen.getByTestId('comprovativo-admin-pag-2')).toHaveTextContent('foto.png');
    });

    fireEvent.click(screen.getByRole('button', { name: /Ver comprovativo/i }));

    await waitFor(() => {
      expect(getComprovativoSignedUrl).toHaveBeenCalledWith('uid/pag-2/foto.png');
      expect(screen.getByTestId('comprovativo-img-pag-2')).toBeInTheDocument();
    });
  });
});
