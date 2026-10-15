import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAcordoDetalhe } from './useAcordoDetalhe.js';
import { buildAcordoDetalheSyncKey } from '../utils/acordoDetalheSyncKey.js';
import { estimateDetalheLoadMs } from '../utils/runAcordoDetalheFetches.js';

vi.mock('../services/PaymentService', () => ({
  listPagamentosByAcordo: vi.fn(),
  getPagamentoForPassageiro: vi.fn(),
  getAcordoContactos: vi.fn(),
  getMesReferenciaAtual: vi.fn(() => '2026-10-01'),
  getObrigacaoPagamentoPassageiro: vi.fn(),
  listPagamentosPendentesMotoristaAcordo: vi.fn(),
}));

vi.mock('../services/RatingService', () => ({
  listMinhasAvaliacoesAcordo: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  listAdendaHistorico: vi.fn(),
}));

vi.mock('../utils/acordoContactosGate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    deveChamarGetAcordoContactos: vi.fn(() => true),
  };
});

import {
  listPagamentosByAcordo,
  getAcordoContactos,
  listPagamentosPendentesMotoristaAcordo,
} from '../services/PaymentService';
import { listMinhasAvaliacoesAcordo } from '../services/RatingService';
import { listAdendaHistorico } from '../services/AgreementService';
import { contactosBloqueadosFallback } from '../utils/acordoContactosGate.js';

const acordoMotorista = {
  id: 'acordo-1',
  estado: 'activo',
  driver_id: 'driver-1',
  acordos_passageiros: [
    { id: 'ap-1', passenger_id: 'pax-1', estado: 'activo' },
  ],
};

const acordoMotoristaA = {
  id: 'acordo-A',
  estado: 'activo',
  driver_id: 'driver-1',
  acordos_passageiros: [{ id: 'ap-a', passenger_id: 'pax-a', estado: 'activo' }],
};

const acordoMotoristaB = {
  id: 'acordo-B',
  estado: 'activo',
  driver_id: 'driver-1',
  acordos_passageiros: [{ id: 'ap-b', passenger_id: 'pax-b', estado: 'activo' }],
};

/** @param {number} ms */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('useAcordoDetalhe — carregar pagamentos fase 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPagamentosByAcordo.mockResolvedValue([{ id: 'pag-1' }]);
    listPagamentosPendentesMotoristaAcordo.mockResolvedValue([
      { pagamento_id: 'mp-1', passenger_nome: 'Ana', estado: 'em_custodia', valor: 40000 },
    ]);
    getAcordoContactos.mockResolvedValue({ bloqueado: false, passageiros: [] });
    listMinhasAvaliacoesAcordo.mockResolvedValue([{ id: 'av-1' }]);
    listAdendaHistorico.mockResolvedValue([{ id: 'ad-1' }]);
  });

  it('dispara os 5 pedidos em paralelo antes de qualquer um resolver', async () => {
    /** @type {string[]} */
    const started = [];
    /** @type {string[]} */
    const finished = [];

    const wrap = (name, fn) => vi.fn(async () => {
      started.push(name);
      await delay(40);
      const result = await fn();
      finished.push(name);
      return result;
    });

    listPagamentosByAcordo.mockImplementation(wrap('pagamentos', () => Promise.resolve([])));
    listPagamentosPendentesMotoristaAcordo.mockImplementation(
      wrap('motorista', () => Promise.resolve([{ pagamento_id: 'm1' }])),
    );
    getAcordoContactos.mockImplementation(wrap('contactos', () => Promise.resolve({ bloqueado: false })));
    listMinhasAvaliacoesAcordo.mockImplementation(wrap('avaliacoes', () => Promise.resolve([])));
    listAdendaHistorico.mockImplementation(wrap('historico', () => Promise.resolve([])));

    const syncKey = buildAcordoDetalheSyncKey(acordoMotorista);
    renderHook(() =>
      useAcordoDetalhe({
        acordo: acordoMotorista,
        syncKey,
        tipoPerfil: 'Motorista',
        userId: 'driver-1',
      }),
    );

    await waitFor(() => {
      expect(started).toHaveLength(5);
    });

    expect(started.sort()).toEqual(['avaliacoes', 'contactos', 'historico', 'motorista', 'pagamentos']);
    expect(finished.length).toBeLessThan(5);
  });

  it('loading do painel motorista é independente de avaliações/adendas', async () => {
    listMinhasAvaliacoesAcordo.mockImplementation(() => delay(200).then(() => [{ id: 'av-lento' }]));
    listAdendaHistorico.mockImplementation(() => delay(200).then(() => [{ id: 'ad-lento' }]));
    listPagamentosPendentesMotoristaAcordo.mockImplementation(() =>
      delay(20).then(() => [{ pagamento_id: 'fast', passenger_nome: 'Ana', estado: 'em_custodia' }]),
    );

    const syncKey = buildAcordoDetalheSyncKey(acordoMotorista);
    const { result } = renderHook(() =>
      useAcordoDetalhe({
        acordo: acordoMotorista,
        syncKey,
        tipoPerfil: 'Motorista',
        userId: 'driver-1',
      }),
    );

    await waitFor(() => {
      expect(result.current.motoristaPagamentosLoading).toBe(false);
    });
    expect(result.current.motoristaPagamentos).toHaveLength(1);
    expect(result.current.avaliacoesLoading).toBe(true);
    expect(result.current.historicoLoading).toBe(true);
  });

  it('refresh silencioso não volta a mostrar loading do painel motorista', async () => {
    const syncKey = buildAcordoDetalheSyncKey(acordoMotorista);
    const { result } = renderHook(
      ({ acordo }) =>
        useAcordoDetalhe({
          acordo,
          syncKey,
          tipoPerfil: 'Motorista',
          userId: 'driver-1',
        }),
      { initialProps: { acordo: acordoMotorista } },
    );

    await waitFor(() => {
      expect(result.current.motoristaPagamentosLoading).toBe(false);
    });

    listPagamentosPendentesMotoristaAcordo.mockImplementation(
      () => delay(80).then(() => [{ pagamento_id: 'mp-2', passenger_nome: 'João', estado: 'em_custodia' }]),
    );

    let revalidatePromise;
    act(() => {
      revalidatePromise = result.current.revalidateSilencioso({
        ...acordoMotorista,
        rescisao_solicitada_em: '2026-10-15T10:00:00.000Z',
      });
    });

    expect(result.current.motoristaPagamentosLoading).toBe(false);
    expect(result.current.motoristaPagamentos[0]?.pagamento_id).toBe('mp-1');

    await act(async () => {
      await revalidatePromise;
    });

    await waitFor(() => {
      expect(result.current.motoristaPagamentos[0]?.pagamento_id).toBe('mp-2');
    });
    expect(result.current.motoristaPagamentosLoading).toBe(false);
    expect(result.current.motoristaPagamentos[0]?.passenger_nome).toBe('João');
  });

  it('refresh silencioso de A não escreve pagamentos/contactos quando B está aberto', async () => {
    /** @type {((v: object[]) => void) | null} */
    let resolvePagamentosA = null;

    listPagamentosPendentesMotoristaAcordo.mockImplementation((acordoId) => {
      if (acordoId === 'acordo-A') {
        return new Promise((resolve) => {
          resolvePagamentosA = resolve;
        });
      }
      return Promise.resolve([
        { pagamento_id: 'pag-B', passenger_nome: 'Certo B', estado: 'em_custodia' },
      ]);
    });

    getAcordoContactos.mockImplementation((acordoId) => {
      if (acordoId === 'acordo-A') {
        return delay(50).then(() => ({ bloqueado: false, passageiros: [{ nome: 'Contacto-A' }] }));
      }
      return Promise.resolve({ bloqueado: false, passageiros: [{ nome: 'Contacto-B' }] });
    });

    const { result } = renderHook(
      ({ acordo }) =>
        useAcordoDetalhe({
          acordo,
          syncKey: buildAcordoDetalheSyncKey(acordo),
          tipoPerfil: 'Motorista',
          userId: 'driver-1',
        }),
      { initialProps: { acordo: acordoMotoristaB } },
    );

    await waitFor(() => {
      expect(result.current.motoristaPagamentos[0]?.pagamento_id).toBe('pag-B');
    });

    let silentPromise;
    act(() => {
      silentPromise = result.current.revalidateSilencioso(acordoMotoristaA);
    });

    await act(async () => {
      resolvePagamentosA?.([
        { pagamento_id: 'pag-A', passenger_nome: 'Errado A', estado: 'em_custodia' },
      ]);
      await silentPromise;
    });

    expect(result.current.motoristaPagamentos[0]?.pagamento_id).toBe('pag-B');
    expect(result.current.motoristaPagamentos.some((r) => r.pagamento_id === 'pag-A')).toBe(false);
    expect(getAcordoContactos).toHaveBeenCalledWith('acordo-A');
    expect(result.current.contactos?.passageiros?.[0]?.nome).not.toBe('Contacto-A');
  });

  it('falha num pedido não apaga as outras secções', async () => {
    listPagamentosPendentesMotoristaAcordo.mockRejectedValue(new Error('RPC motorista'));
    getAcordoContactos.mockRejectedValue(new Error('contactos'));

    const syncKey = buildAcordoDetalheSyncKey(acordoMotorista);
    const { result } = renderHook(() =>
      useAcordoDetalhe({
        acordo: acordoMotorista,
        syncKey,
        tipoPerfil: 'Motorista',
        userId: 'driver-1',
      }),
    );

    await waitFor(() => {
      expect(result.current.avaliacoesLoading).toBe(false);
    });

    expect(result.current.pagamentosAcordo).toHaveLength(1);
    expect(result.current.avaliacoesAcordo).toHaveLength(1);
    expect(result.current.historicoPreco).toHaveLength(1);
    expect(result.current.motoristaPagamentos).toEqual([]);
    expect(result.current.contactos).toEqual(contactosBloqueadosFallback());
  });

  it('harness: 5×150ms paralelo ≈ 1 ronda vs 5 rondas sequenciais', () => {
    const { sequentialMs, parallelMs } = estimateDetalheLoadMs(150, 5);
    expect(sequentialMs).toBe(750);
    expect(parallelMs).toBe(150);
    expect(parallelMs).toBeLessThan(sequentialMs / 4);
  });
});
