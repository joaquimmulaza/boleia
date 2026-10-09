import { describe, it, expect } from 'vitest';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import {
  contagemLugaresVivos,
  lugaresVivos,
  filterMotoristaPagamentosLugaresVivos,
  filterContactosPassageirosVivos,
  labelChipEstadoPassageiro,
  estadoPassageiroParaChip,
} from './estadoPassageiro.js';
import { getMesReferenciaAtual } from '../services/PaymentService.js';

const ACORDO_ID = '104aa236';
const SEAT_RESERVADO = 'pax-seat1-reservado';
const SEAT_SAIU = 'pax-seat2-saiu';

/** Fixture QA acordo 104aa236 — seat1 reservado, seat2 saiu após leave_passenger. */
function acordo104aa236({ linhasPassageiro } = {}) {
  const linhas = [
    {
      id: 'ap-seat1',
      passenger_id: SEAT_RESERVADO,
      estado: 'reservado',
      quota_mensal_kz: 43000,
      perfis: { nome_completo: 'Passageiro A' },
    },
    {
      id: 'ap-seat2',
      passenger_id: SEAT_SAIU,
      estado: 'saiu',
      quota_mensal_kz: 43000,
      perfis: { nome_completo: 'Passageiro B' },
    },
  ];
  return {
    id: ACORDO_ID,
    estado: 'activo',
    n_passageiros_contrato: 2,
    acordos_passageiros: linhasPassageiro ?? linhas,
  };
}

describe('lugares vivos — acordo 104aa236', () => {
  const mes = getMesReferenciaAtual();

  it('1 — contagens só lugares vivos (1 reservado, 0 confirmados)', () => {
    const acordo = acordo104aa236();
    const pagamentosAcordo = [
      {
        passenger_id: SEAT_RESERVADO,
        estado: 'pendente_pagamento',
        mes_referencia: mes,
      },
      {
        passenger_id: SEAT_SAIU,
        estado: 'anulado',
        anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
        mes_referencia: mes,
      },
    ];
    const ctx = { pagamentosAcordo, mesReferencia: mes };
    expect(contagemLugaresVivos(acordo.acordos_passageiros, ctx)).toEqual({
      total: 1,
      confirmados: 0,
      reservados: 1,
    });
    expect(lugaresVivos(acordo, ctx)).toHaveLength(1);
  });

  it('2 — quem saiu nunca chip Reservado (estado saiu e legacy reservado+anulado)', () => {
    expect(labelChipEstadoPassageiro('saiu')).toBe('Saiu');
    expect(
      labelChipEstadoPassageiro('reservado', {
        estado: 'anulado',
        anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
      }),
    ).toBe('Saiu');
    expect(estadoPassageiroParaChip('reservado', {
      estado: 'anulado',
      anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
    })).toBe('saiu');
  });

  it('3 — passageiro: N do cabeçalho = linhas vivas visíveis (RLS omite co-passageiro)', () => {
    const acordo = acordo104aa236({
      linhasPassageiro: [
        {
          id: 'ap-seat1',
          passenger_id: SEAT_RESERVADO,
          estado: 'reservado',
          quota_mensal_kz: 43000,
          perfis: { nome_completo: 'Tu' },
        },
      ],
    });
    const ctx = {
      pagamentosAcordo: [
        { passenger_id: SEAT_RESERVADO, estado: 'pendente_pagamento', mes_referencia: mes },
      ],
      mesReferencia: mes,
      viewerPassengerId: SEAT_RESERVADO,
    };
    expect(acordo.n_passageiros_contrato).toBe(2);
    expect(contagemLugaresVivos(acordo.acordos_passageiros, ctx).total).toBe(1);
  });

  it('4 — pagamentos motorista excluem seat2 anulado', () => {
    const acordo = acordo104aa236();
    const pagamentosAcordo = [
      { passenger_id: SEAT_RESERVADO, estado: 'pendente_pagamento', mes_referencia: mes },
      {
        passenger_id: SEAT_SAIU,
        estado: 'anulado',
        anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
        mes_referencia: mes,
      },
    ];
    const rpcRows = [
      {
        pagamento_id: 'pg-1',
        passenger_id: SEAT_RESERVADO,
        passenger_nome: 'Passageiro A',
        estado: 'pendente_pagamento',
        valor: 43000,
        quota: 43000,
      },
      {
        pagamento_id: 'pg-2',
        passenger_id: SEAT_SAIU,
        passenger_nome: 'Passageiro B',
        estado: 'anulado',
        valor: 43000,
        quota: 43000,
      },
    ];
    const filtrados = filterMotoristaPagamentosLugaresVivos(rpcRows, {
      linhas: acordo.acordos_passageiros,
      pagamentosAcordo,
      mesReferencia: mes,
    });
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].passenger_id).toBe(SEAT_RESERVADO);
  });

  it('5 — contactos só passageiros vivos', () => {
    const contactos = {
      bloqueado: false,
      motorista: { nome_completo: 'Mot', telefone: '923000000' },
      passageiros: [
        { passenger_id: SEAT_RESERVADO, nome_completo: 'A', telefone: '923111111' },
        { passenger_id: SEAT_SAIU, nome_completo: 'B', telefone: '923222222' },
      ],
    };
    const filtrados = filterContactosPassageirosVivos(contactos, [SEAT_RESERVADO]);
    expect(filtrados?.passageiros).toHaveLength(1);
    expect(filtrados?.passageiros?.[0].passenger_id).toBe(SEAT_RESERVADO);
  });
});
