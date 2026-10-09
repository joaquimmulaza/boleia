import { describe, it, expect } from 'vitest';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import {
  contagemLugaresVivos,
  lugaresVivos,
  filterMotoristaPagamentosLugaresVivos,
  filterContactosPassageirosVivos,
  labelChipEstadoPassageiro,
  isLugarVivoPassageiro,
} from './estadoPassageiro.js';

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
  it('1 — contagens só lugares vivos (1 reservado, 0 confirmados)', () => {
    const acordo = acordo104aa236();
    expect(contagemLugaresVivos(acordo.acordos_passageiros)).toEqual({
      total: 1,
      confirmados: 0,
      reservados: 1,
    });
    expect(lugaresVivos(acordo)).toHaveLength(1);
  });

  it('2 — estado saiu → chip Saiu (nunca Reservado)', () => {
    expect(labelChipEstadoPassageiro('saiu')).toBe('Saiu');
    expect(isLugarVivoPassageiro('saiu')).toBe(false);
  });

  it('inconsistência reservado + pagamento anulado → Reservado e conta como vivo', () => {
    const pagamentoAnulado = {
      estado: 'anulado',
      anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
    };
    expect(
      labelChipEstadoPassageiro('reservado', pagamentoAnulado),
    ).toBe('Reservado');
    expect(isLugarVivoPassageiro('reservado')).toBe(true);
    expect(contagemLugaresVivos([{ estado: 'reservado' }])).toEqual({
      total: 1,
      confirmados: 0,
      reservados: 1,
    });
    const rpcRows = [
      {
        pagamento_id: 'pg-x',
        passenger_id: 'pax-inconsistente',
        estado: 'anulado',
        valor: 43000,
      },
    ];
    const linhas = [{ passenger_id: 'pax-inconsistente', estado: 'reservado' }];
    expect(filterMotoristaPagamentosLugaresVivos(rpcRows, { linhas })).toHaveLength(1);
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
    expect(acordo.n_passageiros_contrato).toBe(2);
    expect(contagemLugaresVivos(acordo.acordos_passageiros).total).toBe(1);
  });

  it('4 — pagamentos motorista: lugar saiu + anulado fica oculto (opção B)', () => {
    const acordo = acordo104aa236();
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
    });
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].passenger_id).toBe(SEAT_RESERVADO);
  });

  it('4b — acordo terminado: lugar saiu com dívida/custódia mantém linha de pagamento', () => {
    const linhas = [
      { passenger_id: SEAT_RESERVADO, estado: 'activo' },
      { passenger_id: SEAT_SAIU, estado: 'saiu' },
    ];
    const rpcRows = [
      {
        pagamento_id: 'pg-vivo',
        passenger_id: SEAT_RESERVADO,
        estado: 'em_custodia',
        valor: 43000,
      },
      {
        pagamento_id: 'pg-divida',
        passenger_id: SEAT_SAIU,
        estado: 'pendente_pagamento',
        valor: 43000,
      },
    ];
    const filtrados = filterMotoristaPagamentosLugaresVivos(rpcRows, { linhas });
    expect(filtrados).toHaveLength(2);
    expect(filtrados.map((r) => r.passenger_id).sort()).toEqual(
      [SEAT_RESERVADO, SEAT_SAIU].sort(),
    );
  });

  it('4c — lugar saiu com pagamento pago mantém histórico visível', () => {
    const linhas = [{ passenger_id: SEAT_SAIU, estado: 'saiu' }];
    const rpcRows = [
      {
        pagamento_id: 'pg-hist',
        passenger_id: SEAT_SAIU,
        estado: 'liquidado',
        valor: 43000,
      },
    ];
    expect(filterMotoristaPagamentosLugaresVivos(rpcRows, { linhas })).toHaveLength(1);
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
