import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPagamentoForPassageiro,
  submitPaymentProof,
  uploadComprovativo,
  adminValidatePayment,
  getAcordoContactos,
  listPagamentosPendentesValidacao,
  listPagamentosEmCustodia,
  listRepassesMotorista,
  listAnulacaoMotivoLugarAcordos,
  isListAnulacaoMotivoLugarRpcUnavailable,
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
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eqMes = vi.fn().mockReturnValue({ maybeSingle });
    const eqPax = vi.fn().mockReturnValue({ eq: eqMes });
    const eqAcordo = vi.fn().mockReturnValue({ eq: eqPax });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqAcordo }),
    });

    const result = await getPagamentoForPassageiro('acordo-1', 'pax-1');
    expect(result).toEqual(row);
    expect(supabase.from).toHaveBeenCalledWith('pagamentos_acordo');
    expect(eqAcordo).toHaveBeenCalledWith('acordo_id', 'acordo-1');
    expect(eqPax).toHaveBeenCalledWith('passenger_id', 'pax-1');
    expect(eqMes).toHaveBeenCalledWith('mes_referencia', expect.any(String));
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
    expect(supabase.storage.from.mock.results[0].value.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^pax-1\/pag-1\//),
      file,
      expect.objectContaining({ upsert: true }),
    );
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

  it('getAcordoContactos devolve bloqueado sem throw quando RPC P0001 (acordo cancelado)', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'Sem permissão para ver contactos deste acordo.',
      },
    });
    const result = await getAcordoContactos('acordo-cancelado');
    expect(result.bloqueado).toBe(true);
    expect(result.motivo).toMatch(/Sem permissão/);
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
    const select = supabase.from.mock.results[0].value.select;
    expect(select).toHaveBeenCalledWith(
      '*, acordos(oferta_id, driver_id), perfis!pagamentos_acordo_passenger_id_fkey(nome_completo)',
    );
  });

  it('listPagamentosEmCustodia marca IBAN completo sem pedir a coluna iban', async () => {
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{
            id: 'pag-3',
            acordos: { oferta_id: 'of-1', driver_id: 'drv-1' },
            perfis: { nome_completo: 'Ana' },
          }],
          error: null,
        }),
      }),
    });
    supabase.from.mockReturnValue({ select });
    supabase.rpc.mockResolvedValue({
      data: [{ driver_id: 'drv-1', completo: false }],
      error: null,
    });

    const rows = await listPagamentosEmCustodia();

    expect(select).toHaveBeenCalledWith(
      '*, acordos(oferta_id, driver_id), perfis!pagamentos_acordo_passenger_id_fkey(nome_completo)',
    );
    expect(supabase.rpc).toHaveBeenCalledWith('admin_motoristas_tem_iban', {
      p_driver_ids: ['drv-1'],
    });
    expect(rows[0].acordos.perfis).toEqual({ iban_completo: false });
    expect(rows[0].perfis.nome_completo).toBe('Ana');
  });

  it('listRepassesMotorista pede só o nome do motorista', async () => {
    const select = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    supabase.from.mockReturnValue({ select });

    await listRepassesMotorista();

    expect(select).toHaveBeenCalledWith(
      '*, perfis!repasses_motorista_driver_id_fkey(nome_completo)',
    );
  });

  describe('listAnulacaoMotivoLugarAcordos — degradação preview', () => {
    it('isListAnulacaoMotivoLugarRpcUnavailable reconhece PGRST202 e 42883', () => {
      expect(isListAnulacaoMotivoLugarRpcUnavailable({ code: 'PGRST202' })).toBe(true);
      expect(isListAnulacaoMotivoLugarRpcUnavailable({ code: '42883' })).toBe(true);
      expect(isListAnulacaoMotivoLugarRpcUnavailable({ status: 404 })).toBe(true);
      expect(isListAnulacaoMotivoLugarRpcUnavailable({ message: 'Could not find the function' })).toBe(true);
      expect(isListAnulacaoMotivoLugarRpcUnavailable({ code: '42501' })).toBe(false);
    });

    it('devolve [] sem throw quando RPC não existe (preview)', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.list_anulacao_motivo_lugar_acordos' },
      });
      await expect(listAnulacaoMotivoLugarAcordos(['acordo-1'])).resolves.toEqual([]);
    });

    it('propaga erros que não são indisponibilidade da RPC', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });
      await expect(listAnulacaoMotivoLugarAcordos(['acordo-1'])).rejects.toMatchObject({ code: '42501' });
    });
  });
});
