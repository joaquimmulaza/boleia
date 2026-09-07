import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPagamentoForPassageiro,
  submitPaymentProof,
  uploadComprovativo,
  adminValidatePayment,
  getAcordoContactos,
  listPagamentosPendentesValidacao,
} from './PaymentService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('PaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPagamentoForPassageiro devolve linha do acordo do passageiro', async () => {
    const row = { id: 'pag-1', estado: 'pendente_pagamento', valor_kz: 43000 };
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      }),
    });

    const result = await getPagamentoForPassageiro('acordo-1', 'pax-1');
    expect(result).toEqual(row);
    expect(supabase.from).toHaveBeenCalledWith('pagamentos_acordo');
  });

  it('submitPaymentProof chama RPC submit_payment_proof', async () => {
    supabase.rpc.mockResolvedValue({ data: 'pag-1', error: null });
    await submitPaymentProof('pag-1', 'pax-1/pag-1/proof.pdf');
    expect(supabase.rpc).toHaveBeenCalledWith('submit_payment_proof', {
      p_pagamento_id: 'pag-1',
      p_storage_path: 'pax-1/pag-1/proof.pdf',
    });
  });

  it('uploadComprovativo envia ficheiro e submete comprovativo', async () => {
    const file = new File(['x'], 'proof.pdf', { type: 'application/pdf' });
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'pax-1' } } });
    supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'pax-1/pag-1/proof.pdf' }, error: null }),
    });
    supabase.rpc.mockResolvedValue({ data: 'pag-1', error: null });

    await uploadComprovativo('pag-1', file);

    expect(supabase.storage.from).toHaveBeenCalledWith('comprovativos-pagamento');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'submit_payment_proof',
      expect.objectContaining({ p_pagamento_id: 'pag-1' }),
    );
  });

  it('adminValidatePayment aprova via RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: 'pag-1', error: null });
    await adminValidatePayment('pag-1', true);
    expect(supabase.rpc).toHaveBeenCalledWith('admin_validate_payment', {
      p_pagamento_id: 'pag-1',
      p_aprovar: true,
      p_motivo: null,
    });
  });

  it('adminValidatePayment rejeita com motivo', async () => {
    supabase.rpc.mockResolvedValue({ data: 'pag-1', error: null });
    await adminValidatePayment('pag-1', false, 'Comprovativo ilegível');
    expect(supabase.rpc).toHaveBeenCalledWith('admin_validate_payment', {
      p_pagamento_id: 'pag-1',
      p_aprovar: false,
      p_motivo: 'Comprovativo ilegível',
    });
  });

  it('getAcordoContactos usa RPC get_acordo_contactos', async () => {
    const payload = { bloqueado: false, motorista: { telefone: '+244923000001' } };
    supabase.rpc.mockResolvedValue({ data: payload, error: null });
    const result = await getAcordoContactos('acordo-1');
    expect(supabase.rpc).toHaveBeenCalledWith('get_acordo_contactos', {
      p_acordo_id: 'acordo-1',
    });
    expect(result).toEqual(payload);
  });

  it('listPagamentosPendentesValidacao filtra comprovativo_enviado', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'pag-2', estado: 'comprovativo_enviado' }],
            error: null,
          }),
        }),
      }),
    });

    const rows = await listPagamentosPendentesValidacao();
    expect(rows).toHaveLength(1);
  });
});
