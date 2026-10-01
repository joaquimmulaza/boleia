import { describe, it, expect } from 'vitest';
import {
  RATING_MOMENTO,
  RATING_WINDOW_DAYS,
  isPeriodoLiquidado,
  getFirstSettledAt,
  getRatingWindowEnd,
  resolveRatingPromptEstado,
  buildPassageiroRatingPrompt,
  buildMotoristaRatingPrompts,
  buildSaidaRatingPrompt,
  counterpartySeesApenasAvaliado,
} from './ratingGates.js';

describe('ratingGates — elegibilidade ENG#32c', () => {
  const settledAt = '2026-09-01T10:00:00.000Z';
  const withinWindow = '2026-09-10T10:00:00.000Z';
  const afterWindow = '2026-09-20T10:00:00.000Z';

  it('isPeriodoLiquidado aceita em_custodia e liquidado', () => {
    expect(isPeriodoLiquidado('em_custodia')).toBe(true);
    expect(isPeriodoLiquidado('liquidado')).toBe(true);
    expect(isPeriodoLiquidado('pendente_pagamento')).toBe(false);
  });

  it('getFirstSettledAt usa validado_em ou liquidado_em do 1.º período', () => {
    const pagamentos = [
      { estado: 'pendente_pagamento', validado_em: null },
      { estado: 'em_custodia', validado_em: settledAt, mes_referencia: '2026-09-01' },
    ];
    expect(getFirstSettledAt(pagamentos)).toBe(settledAt);
  });

  it('janela M1 expira após RATING_WINDOW_DAYS', () => {
    const end = getRatingWindowEnd(settledAt);
    expect(end).toBeTruthy();
    const diffDays = (new Date(end).getTime() - new Date(settledAt).getTime()) / 86400000;
    expect(diffDays).toBe(RATING_WINDOW_DAYS);
  });

  it('resolveRatingPromptEstado: pendente dentro da janela sem submissão', () => {
    expect(
      resolveRatingPromptEstado({
        now: withinWindow,
        settledAt,
        submitted: false,
        momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
        passageiroEstado: 'activo',
      }),
    ).toBe('pendente');
  });

  it('resolveRatingPromptEstado: feito após submissão', () => {
    expect(
      resolveRatingPromptEstado({
        now: withinWindow,
        settledAt,
        submitted: true,
        momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
        passageiroEstado: 'activo',
      }),
    ).toBe('feito');
  });

  it('resolveRatingPromptEstado: expirado após janela M1', () => {
    expect(
      resolveRatingPromptEstado({
        now: afterWindow,
        settledAt,
        submitted: false,
        momento: RATING_MOMENTO.PRIMEIRO_PERIODO,
        passageiroEstado: 'activo',
      }),
    ).toBe('expirado');
  });

  it('passageiro expirado (TTL) não é elegível', () => {
    expect(
      buildPassageiroRatingPrompt({
        acordoId: 'a1',
        acordoPassageiroId: 'ap1',
        passageiroEstado: 'expirado',
        pagamentos: [{ estado: 'em_custodia', validado_em: settledAt }],
        avaliacoes: [],
        now: withinWindow,
        driverNome: 'João M.',
      }),
    ).toBeNull();
  });

  it('buildPassageiroRatingPrompt M1 pendente para passageiro activo', () => {
    const prompt = buildPassageiroRatingPrompt({
      acordoId: 'a1',
      acordoPassageiroId: 'ap1',
      passageiroEstado: 'activo',
      pagamentos: [{ acordo_passageiro_id: 'ap1', estado: 'em_custodia', validado_em: settledAt, mes_referencia: '2026-09-01' }],
      avaliacoes: [],
      now: withinWindow,
      driverNome: 'João M.',
      avaliadorId: 'pax-1',
    });
    expect(prompt?.estado).toBe('pendente');
    expect(prompt?.momento).toBe(RATING_MOMENTO.PRIMEIRO_PERIODO);
    expect(prompt?.ctaLabel).toBe('Avaliar motorista');
  });

  it('buildPassageiroRatingPrompt resolve pagamentos só com passenger_id (legado)', () => {
    const prompt = buildPassageiroRatingPrompt({
      acordoId: 'a1',
      acordoPassageiroId: 'ap1',
      passageiroEstado: 'activo',
      pagamentos: [{ passenger_id: 'pax-1', estado: 'em_custodia', validado_em: settledAt, mes_referencia: '2026-09-01' }],
      avaliacoes: [],
      now: withinWindow,
      driverNome: 'João M.',
      avaliadorId: 'pax-1',
    });
    expect(prompt?.estado).toBe('pendente');
  });

  it('hasSubmitted exige avaliador_id nas linhas carregadas', () => {
    const prompts = buildMotoristaRatingPrompts({
      acordoId: 'a1',
      passageiros: [
        { id: 'ap1', passenger_id: 'p1', estado: 'activo', perfis: { nome_completo: 'Ana S.' } },
      ],
      pagamentos: [
        { acordo_passageiro_id: 'ap1', estado: 'em_custodia', validado_em: settledAt, mes_referencia: '2026-09-01' },
      ],
      avaliacoes: [
        { acordo_passageiro_id: 'ap1', momento: RATING_MOMENTO.PRIMEIRO_PERIODO, avaliador_id: 'mot-1' },
      ],
      now: withinWindow,
      driverId: 'mot-1',
    });
    expect(prompts[0]?.estado).toBe('feito');
  });

  it('buildMotoristaRatingPrompts lista N passageiros com estados', () => {
    const prompts = buildMotoristaRatingPrompts({
      acordoId: 'a1',
      passageiros: [
        { id: 'ap1', passenger_id: 'p1', estado: 'activo', perfis: { nome_completo: 'Ana S.' } },
        { id: 'ap2', passenger_id: 'p2', estado: 'activo', perfis: { nome_completo: 'Carlos M.' } },
      ],
      pagamentos: [
        { acordo_passageiro_id: 'ap1', estado: 'em_custodia', validado_em: settledAt, mes_referencia: '2026-09-01' },
        { acordo_passageiro_id: 'ap2', estado: 'em_custodia', validado_em: settledAt, mes_referencia: '2026-09-01' },
      ],
      avaliacoes: [{ acordo_passageiro_id: 'ap2', momento: RATING_MOMENTO.PRIMEIRO_PERIODO, avaliador_id: 'mot-1' }],
      now: withinWindow,
      driverId: 'mot-1',
    });
    expect(prompts).toHaveLength(2);
    expect(prompts.find((p) => p.acordoPassageiroId === 'ap1')?.estado).toBe('pendente');
    expect(prompts.find((p) => p.acordoPassageiroId === 'ap2')?.estado).toBe('feito');
  });

  it('buildSaidaRatingPrompt pendente antes de sair', () => {
    const prompt = buildSaidaRatingPrompt({
      acordoId: 'a1',
      acordoPassageiroId: 'ap1',
      passageiroEstado: 'activo',
      pagamentos: [{ acordo_passageiro_id: 'ap1', estado: 'em_custodia', validado_em: settledAt }],
      avaliacoes: [],
      now: withinWindow,
      avaliadorId: 'pax-1',
    });
    expect(prompt?.estado).toBe('pendente');
    expect(prompt?.momento).toBe(RATING_MOMENTO.SAIDA);
  });

  it('contraparte só vê «avaliado» — comentário nunca exposto', () => {
    const view = counterpartySeesApenasAvaliado({
      wasAvaliado: true,
      ratingRow: { comentario: 'texto secreto', estrelas: 4 },
    });
    expect(view).toEqual({ avaliado: true, label: 'Avaliado' });
    expect(view).not.toHaveProperty('comentario');
    expect(view).not.toHaveProperty('estrelas');
  });
});
