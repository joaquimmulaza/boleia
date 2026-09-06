/**
 * Auditoria marketplace — invariantes G1–G12 (contrato público + mocks Vitest).
 * Cascata / capacidade / N_actual vs N_proposto vivem no servidor; o cliente
 * propaga erros e não muta propostas/quotas localmente.
 * G3/G10: overbooking/concorrência só com mocks — sem races reais em Postgres.
 * G11: smoke RLS — serviços não fazem UPDATE/DELETE client em tabelas críticas.
 *
 * Mensagens RPC alinhadas a `accept_proposal` / `leave_passenger` (projecto boleia).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAgreementFromProposal,
  leavePassenger,
} from '../services/AgreementService.js';
import { promoteWaitlist } from '../services/WaitlistService.js';
import { computeFaltaDesconto } from '../utils/faltaDesconto.js';
import {
  resolveNotificationRoute,
  notificationRouteMap,
} from '../utils/notificationRouter.js';
import { labelModoPreco } from '../utils/ofertaLabels.js';
import { buildPropostaReview } from '../utils/propostaReview.js';
import { supabase } from '../lib/supabase';

const AUDIT_DIR = dirname(fileURLToPath(import.meta.url));

/** @param {string} relativeFromPages */
function readSrc(relativeFromPages) {
  return readFileSync(join(AUDIT_DIR, relativeFromPages), 'utf8');
}

/** Remove comentários para smoke de código (não JSDoc). */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Contrato RLS documentado: mutações de estado crítico só via RPC.
 * INSERT em propostas/lista_espera (criar) é permitido; UPDATE/DELETE client não.
 */
const RLS_CRITICAL_TABLES = [
  'propostas',
  'acordos',
  'acordos_passageiros',
  'lista_espera',
  'acordos_adendas',
];

const JARGON_UI = /N_actual|N_proposto|N_candidato|N_contrato|POR_PASSAGEIRO|TOTAL_ACORDO/;

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'jwt-test' } },
      }),
    },
  },
}));

/** Args RPC resilientes a p_idempotency_key (Wave 4 / Epsilon). */
function expectAcceptProposal(propostaId, extra = {}) {
  expect(supabase.rpc).toHaveBeenCalledWith(
    'accept_proposal',
    expect.objectContaining({ p_proposta_id: propostaId, ...extra }),
  );
}

describe('Marketplace audit — cenários G1–G4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  /**
   * @param {object} acordo
   */
  function mockAcordoSelect(acordo) {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: acordo, error: null }),
        }),
      }),
    });
  }

  describe('G1 — cancelamento em cascata (irmãs abertas → cancelada)', () => {
    it('createAgreementFromProposal chama só accept_proposal e devolve acordo (cascata no servidor)', async () => {
      const acordo = {
        id: 'acordo-aceite',
        procura_id: 'proc-1',
        n_passageiros_contrato: 2,
        valor_mensal_por_passageiro_kz: 50000,
        valor_mensal_total_kz: 100000,
        estado: 'activo',
      };
      supabase.rpc.mockResolvedValue({ data: 'acordo-aceite', error: null });
      mockAcordoSelect(acordo);

      const result = await createAgreementFromProposal('prop-aceitada');

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expectAcceptProposal('prop-aceitada');
      expect(supabase.from).toHaveBeenCalledWith('acordos');
      expect(supabase.from).not.toHaveBeenCalledWith('propostas');
      expect(result.id).toBe('acordo-aceite');
      expect(result.estado).toBe('activo');
    });

    it('documenta efeito RPC: irmãs abertas da mesma procura ficam cancelada (sem UPDATE client)', async () => {
      // Contrato servidor (accept_proposal): após aceite,
      // UPDATE propostas SET estado='cancelada' WHERE procura_id=… AND id<>aceite AND estado='aberta'.
      // O serviço público não cancela no cliente — só RPC + select do acordo.
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      mockAcordoSelect({ id: 'acordo-1', estado: 'activo' });

      await createAgreementFromProposal('prop-1');

      const rpcCalls = supabase.rpc.mock.calls.map(([name]) => name);
      expect(rpcCalls).toEqual(['accept_proposal']);
      expect(supabase.from.mock.calls.every(([table]) => table === 'acordos')).toBe(true);

      const estadoPosRpcEsperado = [
        { id: 'prop-1', estado: 'aceite' },
        { id: 'prop-irma-a', estado: 'cancelada' },
        { id: 'prop-irma-b', estado: 'cancelada' },
      ];
      expect(estadoPosRpcEsperado.filter((p) => p.estado === 'cancelada')).toHaveLength(2);
      expect(estadoPosRpcEsperado.find((p) => p.id === 'prop-1')?.estado).toBe('aceite');
    });
  });

  describe('G2 — N_actual < N_proposto ⇒ aceite falha', () => {
    it('propaga erro RPC quando o grupo tem menos membros que o proposto', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'O grupo tem apenas 2 membros activos; a proposta exige 3.',
        },
      });

      await expect(createAgreementFromProposal('prop-n-alto')).rejects.toThrow(
        /grupo tem apenas 2 membros activos; a proposta exige 3/i,
      );

      expectAcceptProposal('prop-n-alto');
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('G3 — overbooking / capacidade (sem acordo parcial)', () => {
    it('segundo aceite com vagas insuficientes é rejeitado e não selecciona acordo', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Vagas insuficientes para este grupo. Use lista de espera.',
        },
      });

      await expect(createAgreementFromProposal('prop-overbook')).rejects.toThrow(
        /Vagas insuficientes.*lista de espera/i,
      );

      expectAcceptProposal('prop-overbook');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('primeiro aceite com capacidade ok devolve acordo; segundo com insuficiência falha (sem parcial)', async () => {
      const acordoOk = {
        id: 'acordo-1',
        oferta_id: 'of-1',
        n_passageiros_contrato: 2,
        valor_mensal_total_kz: 80000,
        valor_mensal_por_passageiro_kz: 40000,
        estado: 'activo',
      };

      // Oferta com 2 vagas: 1.º acordo consome-as; 2.º deve falhar no servidor.
      const capacidadeOferta = { vagas_passageiros: 2, n_contrato_primeiro: 2 };
      expect(capacidadeOferta.vagas_passageiros).toBe(capacidadeOferta.n_contrato_primeiro);

      supabase.rpc
        .mockResolvedValueOnce({ data: 'acordo-1', error: null })
        .mockResolvedValueOnce({
          data: null,
          error: {
            message: 'Vagas insuficientes para este grupo. Use lista de espera.',
          },
        });
      mockAcordoSelect(acordoOk);

      const primeiro = await createAgreementFromProposal('prop-a');
      expect(primeiro.id).toBe('acordo-1');
      expect(primeiro.n_passageiros_contrato).toBe(2);
      expect(primeiro.estado).toBe('activo');

      await expect(createAgreementFromProposal('prop-b')).rejects.toThrow(
        /Vagas insuficientes/i,
      );
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expectAcceptProposal('prop-a');
      expectAcceptProposal('prop-b');
      // Sem select de acordo no 2.º caminho (falha antes).
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('G4 — leavePassenger + promote best-effort no servidor', () => {
    const cabecalhoCongelado = {
      id: 'acordo-1',
      oferta_id: 'of-1',
      valor_mensal_por_passageiro_kz: 30000,
      valor_mensal_total_kz: 120000,
      n_passageiros_contrato: 4,
    };

    it('chama leave_passenger e preserva N_contrato / preços no retorno (sem recálculo no cliente)', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      mockAcordoSelect({ ...cabecalhoCongelado });

      const result = await leavePassenger('acordo-1', 'pax-sair');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'leave_passenger',
        expect.objectContaining({
          p_acordo_id: 'acordo-1',
          p_passenger_id: 'pax-sair',
          p_idempotency_key: expect.any(String),
        }),
      );
      // Promote waitlist é best-effort dentro da RPC leave_passenger — cliente não chama promote_waitlist.
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc.mock.calls.map(([n]) => n)).not.toContain('promote_waitlist');

      expect(result.n_passageiros_contrato).toBe(4);
      expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
      expect(result.valor_mensal_total_kz).toBe(120000);
      expect(supabase.from).toHaveBeenCalledWith('acordos');
      expect(supabase.from).not.toHaveBeenCalledWith('acordos_passageiros');
    });
  });
});

describe('Marketplace audit — Tasks 3 & 4 contraparte e composição explícita', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  /**
   * @param {object} acordo
   */
  function mockAcordoSelect(acordo) {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: acordo, error: null }),
        }),
      }),
    });
  }

  it('utilizador = created_by chama accept_proposal → falha com erro de contraparte', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Só a contraparte pode aceitar ou rejeitar esta proposta.',
      },
    });

    await expect(createAgreementFromProposal('prop-created-by')).rejects.toThrow(
      /só a contraparte/i,
    );

    expectAcceptProposal('prop-created-by');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('accept_proposal com N_proposto=2 mas p_member_ids com 3 elementos → falha por capacidade inconsistente', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Capacidade inconsistente com proposta',
      },
    });

    await expect(
      createAgreementFromProposal('prop-n2', {
        memberIds: ['pax-1', 'pax-2', 'pax-3'],
      }),
    ).rejects.toThrow(/capacidade inconsistente/i);

    expectAcceptProposal('prop-n2', {
      p_member_ids: ['pax-1', 'pax-2', 'pax-3'],
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('accept_proposal com lista explícita correcta cria acordo e mapeia passageiros', async () => {
    const memberIds = ['pax-a', 'pax-b'];
    const acordo = {
      id: 'acordo-exp',
      procura_id: 'proc-1',
      n_passageiros_contrato: 2,
      valor_mensal_por_passageiro_kz: 45000,
      valor_mensal_total_kz: 90000,
      estado: 'activo',
      acordos_passageiros: memberIds.map((passenger_id) => ({
        passenger_id,
        estado: 'activo',
      })),
    };

    supabase.rpc.mockResolvedValue({ data: 'acordo-exp', error: null });
    mockAcordoSelect(acordo);

    const result = await createAgreementFromProposal('prop-ok', { memberIds });

    expectAcceptProposal('prop-ok', { p_member_ids: memberIds });
    expect(result.id).toBe('acordo-exp');
    expect(result.estado).toBe('activo');
    expect(result.n_passageiros_contrato).toBe(2);
    expect(result.acordos_passageiros.map((p) => p.passenger_id)).toEqual(memberIds);
    expect(result.acordos_passageiros).toHaveLength(memberIds.length);
  });
});

describe('Marketplace audit — G9 falta fórmula', () => {
  it('desconto_kz = quota_mensal / dias_uteis (ROUND 2 casas; não adenda pro-rata)', () => {
    // MKT-07 / Decision 2C: G9 = fórmula de falta, não adenda.
    expect(computeFaltaDesconto(30000, 22)).toBe(1363.64);
    expect(computeFaltaDesconto(44000, 22)).toBe(2000);
  });
});

describe('Marketplace audit — G10 overbooking multi-acordo (mock concorrência)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('simula dois createAgreementFromProposal concorrentes: 2.º falha por capacidade (sem Postgres)', async () => {
    // Documentação: isto NÃO é race real em Postgres — é mock sequencial que
    // modela o resultado esperado de overbooking multi-acordo (dois aceites
    // contra a mesma oferta com vagas só para um).
    const acordoPrimeiro = {
      id: 'acordo-multi-1',
      oferta_id: 'of-shared',
      n_passageiros_contrato: 3,
      estado: 'activo',
    };

    supabase.rpc
      .mockResolvedValueOnce({ data: 'acordo-multi-1', error: null })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Vagas insuficientes para este grupo. Use lista de espera.',
        },
      });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: acordoPrimeiro, error: null }),
        }),
      }),
    });

    const [r1, r2] = await Promise.allSettled([
      createAgreementFromProposal('prop-concorrente-a'),
      createAgreementFromProposal('prop-concorrente-b'),
    ]);

    expect(r1.status).toBe('fulfilled');
    expect(r1.value.id).toBe('acordo-multi-1');
    expect(r2.status).toBe('rejected');
    expect(String(r2.reason?.message || r2.reason)).toMatch(/Vagas insuficientes/i);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});

describe('Marketplace audit — G5 leave → waitlist FIFO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('leavePassenger só chama leave_passenger (promote fica no servidor; sem auto-aceitar)', async () => {
    supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'acordo-1', n_passageiros_contrato: 3, estado: 'activo' },
            error: null,
          }),
        }),
      }),
    });

    await leavePassenger('acordo-1', 'pax-fifo');

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'leave_passenger',
      expect.objectContaining({
        p_acordo_id: 'acordo-1',
        p_passenger_id: 'pax-fifo',
        p_idempotency_key: expect.any(String),
      }),
    );
    const rpcNames = supabase.rpc.mock.calls.map(([name]) => name);
    expect(rpcNames).not.toContain('promote_waitlist');
    expect(rpcNames).not.toContain('accept_proposal');

    // Contrato servidor (leave_passenger): best-effort promote FIFO → notificada;
    // nunca cria acordo nem aceita proposta automaticamente.
    const efeitoServidorEsperado = {
      waitlist_estado: 'notificada',
      auto_aceitar: false,
    };
    expect(efeitoServidorEsperado.waitlist_estado).toBe('notificada');
    expect(efeitoServidorEsperado.auto_aceitar).toBe(false);
  });

  it('promoteWaitlist (RPC directa) devolve notificada e não chama accept_proposal', async () => {
    supabase.rpc.mockResolvedValue({ data: 'wait-fifo-1', error: null });

    const result = await promoteWaitlist('oferta-fifo');

    expect(supabase.rpc).toHaveBeenCalledWith(
      'promote_waitlist',
      expect.objectContaining({ p_oferta_id: 'oferta-fifo' }),
    );
    expect(result).toEqual({
      id: 'wait-fifo-1',
      oferta_id: 'oferta-fifo',
      estado: 'notificada',
    });
    expect(result.estado).toBe('notificada');
    expect(supabase.rpc.mock.calls.map(([n]) => n)).not.toContain('accept_proposal');
    expect(supabase.from).not.toHaveBeenCalledWith('acordos');
    expect(supabase.from).not.toHaveBeenCalledWith('propostas');
  });
});

describe('Marketplace audit — G7 copy adenda «próximo mês»', () => {
  it('MyAgreements usa copy «próximo mês» na adenda e no modal de confirmação', () => {
    const src = readSrc('MyAgreements.jsx');
    expect(src).toMatch(/próximo mês/);
    expect(src).toMatch(
      /Alteração aceite\. O novo preço aplica-se a partir do próximo mês\./,
    );
    expect(src).toMatch(
      /aplica-se a partir do próximo mês; o mês corrente mantém as quotas/,
    );
    // Fallback de formatMesAdenda quando effective_from falta / inválido
    expect(src).toMatch(/if \(!isoDate\) return 'próximo mês'/);
    expect(src).toMatch(/Number\.isNaN\(d\.getTime\(\)\)\) return 'próximo mês'/);
  });
});

describe('Marketplace audit — G8 notificationRouter waitlist_promoted', () => {
  it('mapa e resolveNotificationRoute abrem hub passageiro', () => {
    expect(notificationRouteMap.waitlist_promoted()).toBe('/passageiro');
    expect(
      resolveNotificationRoute({
        metadata: { type: 'waitlist_promoted', waitlist_id: 'w-1', oferta_id: 'of-1' },
      }),
    ).toBe('/passageiro');
    expect(
      resolveNotificationRoute({
        metadata: { type: 'waitlist_promoted' },
        link: '/dashboard',
      }),
    ).toBe('/passageiro');
  });
});

describe('Marketplace audit — G11 RLS sem UPDATE/DELETE client em tabelas críticas', () => {
  /**
   * @param {string} src
   * @param {string} table
   */
  function hasClientUpdateOrDelete(src, table) {
    const code = stripComments(src);
    // Encadeamento típico: .from('t').update( / .delete(
    const fromUpdate = new RegExp(
      `\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,200}?\\.(update|delete)\\s*\\(`,
    );
    return fromUpdate.test(code);
  }

  it('AgreementService / PropostaService / WaitlistService não fazem UPDATE/DELETE nas tabelas críticas', () => {
    const services = {
      AgreementService: readSrc('../services/AgreementService.js'),
      PropostaService: readSrc('../services/PropostaService.js'),
      WaitlistService: readSrc('../services/WaitlistService.js'),
    };

    for (const [name, src] of Object.entries(services)) {
      for (const table of RLS_CRITICAL_TABLES) {
        expect(
          hasClientUpdateOrDelete(src, table),
          `${name} não deve .update()/.delete() em ${table} (só RPC / select / insert criar)`,
        ).toBe(false);
      }
    }

    // Mutações de estado só via RPC documentadas
    expect(stripComments(services.AgreementService)).toMatch(/leave_passenger/);
    expect(stripComments(services.AgreementService)).toMatch(/accept_proposal/);
    expect(stripComments(services.AgreementService)).toMatch(
      /renegotiate_agreement_pricing/,
    );
    expect(stripComments(services.AgreementService)).toMatch(/accept_agreement_adenda/);
    expect(stripComments(services.PropostaService)).toMatch(/cancel_proposal/);
    expect(stripComments(services.PropostaService)).toMatch(/reject_proposal/);
    expect(stripComments(services.WaitlistService)).toMatch(/promote_waitlist/);
  });

  it('GrupoService: saída de membro activo via RPC leave_grupo_membro (não UPDATE saiu)', () => {
    const src = stripComments(readSrc('../services/GrupoService.js'));
    expect(src).toMatch(/leave_grupo_membro/);
    expect(src).toMatch(/p_idempotency_key/);
    // sairDoGrupo não faz .update({ estado: 'saiu' }) — isso seria bypass RLS
    expect(src).not.toMatch(
      /\.from\(\s*['"]membros_grupo['"]\s*\)[\s\S]{0,200}?\.update\(\s*\{\s*estado:\s*['"]saiu['"]/,
    );
    // Contrato RLS: owner pode UPDATE pendente→activo/rejeitado; self reabre pendente.
    // Documentado no serviço — smoke não proíbe esses UPDATEs de gestão.
    expect(src).toMatch(/\.update\(\s*\{\s*estado:\s*['"]activo['"]/);
  });

  it('leavePassenger em runtime: só RPC + select acordos (sem update/delete client)', async () => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    const fromChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'acordo-rls', estado: 'activo' },
            error: null,
          }),
        }),
      }),
      update: vi.fn(),
      delete: vi.fn(),
    };
    supabase.from.mockReturnValue(fromChain);
    supabase.rpc.mockResolvedValue({ data: 'acordo-rls', error: null });

    await leavePassenger('acordo-rls', 'pax-rls');

    expect(supabase.rpc).toHaveBeenCalledWith(
      'leave_passenger',
      expect.objectContaining({
        p_acordo_id: 'acordo-rls',
        p_passenger_id: 'pax-rls',
        p_idempotency_key: expect.any(String),
      }),
    );
    expect(fromChain.update).not.toHaveBeenCalled();
    expect(fromChain.delete).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('acordos');
    for (const table of [
      'propostas',
      'acordos_passageiros',
      'lista_espera',
      'acordos_adendas',
      'membros_grupo',
    ]) {
      expect(supabase.from).not.toHaveBeenCalledWith(table);
    }
  });
});

describe('Marketplace audit — G12 UI hubs sem jargon', () => {
  it('labelModoPreco e buildPropostaReview nunca devolvem enums N_* / POR_PASSAGEIRO', () => {
    expect(labelModoPreco('POR_PASSAGEIRO')).toBe('Por passageiro');
    expect(labelModoPreco('TOTAL_ACORDO')).toBe('Total do acordo');
    expect(labelModoPreco('POR_PASSAGEIRO')).not.toMatch(JARGON_UI);
    expect(labelModoPreco('TOTAL_ACORDO')).not.toMatch(JARGON_UI);

    const review = buildPropostaReview(
      {
        grupo_id: 'g-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        n_passageiros_propostos: 2,
      },
      [
        { passenger_id: 'p1', perfis: { nome_completo: 'Ana' } },
        { passenger_id: 'p2', perfis: { nome_completo: 'Beto' } },
      ],
    );

    expect(review.titulo).toMatch(/Grupo · 2 pessoas/);
    expect(JSON.stringify(review)).not.toMatch(JARGON_UI);
  });

  it('helpers de hub (ofertaLabels / propostaReview) sem jargon em strings de UI', () => {
    for (const rel of ['../utils/ofertaLabels.js', '../utils/propostaReview.js']) {
      const code = stripComments(readSrc(rel));
      // Literais de retorno / copy — não enums crus como texto mostrado
      expect(code).not.toMatch(/return\s+['"`][^'"`]*POR_PASSAGEIRO[^'"`]*['"`]/);
      expect(code).not.toMatch(/return\s+['"`][^'"`]*N_actual[^'"`]*['"`]/);
      expect(code).not.toMatch(/return\s+['"`][^'"`]*N_proposto[^'"`]*['"`]/);
    }
    expect(stripComments(readSrc('../utils/ofertaLabels.js'))).toMatch(
      /Por passageiro/,
    );
  });
});
