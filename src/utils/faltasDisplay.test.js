import { describe, it, expect } from 'vitest';
import {
  filterFaltasEsteMes,
  filterFaltasDescontoMesAtual,
  descontoMesReferenciaFalta,
  sumDescontoFaltas,
  todayLuandaISO,
  isFutureFaltaDate,
  formatFaltaDiaCurto,
  resolveFaltasHubCard,
  resolveDescontoFaltasTotal,
  sumDescontoFaltasParaPassageiro,
} from './faltasDisplay';

describe('faltasDisplay', () => {
  const refOct15 = new Date('2026-10-15T12:00:00Z');
  const refOct1 = new Date('2026-10-01T12:00:00Z');
  const MES = '2026-10-01';

  it('filtra faltas do mês corrente em Luanda (inclui futuras no mês)', () => {
    const faltas = [
      { id: '1', data_falta: '2026-09-30', desconto_kz: 100 },
      { id: '2', data_falta: '2026-10-01', desconto_kz: 200 },
      { id: '3', data_falta: '2026-10-15', desconto_kz: 1272.73 },
      { id: '4', data_falta: '2026-11-01', desconto_kz: 50 },
      { id: '5', data_falta: '2026-10-25', desconto_kz: 300 },
    ];

    const esteMes = filterFaltasEsteMes(faltas, refOct1);

    expect(esteMes.map((f) => f.id)).toEqual(['2', '3', '5']);
  });

  it('em custódia com desconto_faltas_kz 0 usa soma client-side (passageiro)', () => {
    const faltas = [
      { tipo: 'Passageiro', passenger_id: 'pax-1', desconto_kz: 500 },
      { tipo: 'Motorista', desconto_kz: 650 },
      { tipo: 'Passageiro', passenger_id: 'pax-2', desconto_kz: 200 },
    ];
    const pagamentos = [
      {
        passenger_id: 'pax-1',
        mes_referencia: MES,
        estado: 'em_custodia',
        desconto_faltas_kz: 0,
      },
    ];
    expect(
      resolveDescontoFaltasTotal(pagamentos, faltas, {
        tipoPerfil: 'Passageiro',
        passengerId: 'pax-1',
        refDate: refOct15,
      }),
    ).toBe(1150);
  });

  it('pagamento liquidado usa desconto_faltas_kz (passageiro)', () => {
    const faltas = [{ tipo: 'Passageiro', passenger_id: 'pax-1', desconto_kz: 500 }];
    const pagamentos = [
      {
        passenger_id: 'pax-1',
        mes_referencia: MES,
        estado: 'liquidado',
        desconto_faltas_kz: 3000,
      },
    ];
    expect(
      resolveDescontoFaltasTotal(pagamentos, faltas, {
        tipoPerfil: 'Passageiro',
        passengerId: 'pax-1',
        refDate: refOct15,
      }),
    ).toBe(3000);
  });

  it('motorista liquidado: soma desconto_faltas_kz de cada passageiro (sem dedupe)', () => {
    const faltas = [
      { tipo: 'Passageiro', passenger_id: 'pax-1', desconto_kz: 400 },
      { tipo: 'Passageiro', passenger_id: 'pax-2', desconto_kz: 300 },
      { tipo: 'Motorista', desconto_kz: 500 },
    ];
    const pagamentos = [
      {
        passenger_id: 'pax-1',
        mes_referencia: MES,
        estado: 'liquidado',
        desconto_faltas_kz: 900,
      },
      {
        passenger_id: 'pax-2',
        mes_referencia: MES,
        estado: 'liquidado',
        desconto_faltas_kz: 800,
      },
    ];
    expect(
      resolveDescontoFaltasTotal(pagamentos, faltas, {
        tipoPerfil: 'Motorista',
        refDate: refOct15,
      }),
    ).toBe(1700);
  });

  it('motorista em custódia: falta Motorista × passageiros activos + faltas pax', () => {
    const faltas = [
      { tipo: 'Passageiro', passenger_id: 'pax-1', desconto_kz: 400 },
      { tipo: 'Motorista', desconto_kz: 500 },
    ];
    expect(
      resolveDescontoFaltasTotal([], faltas, {
        tipoPerfil: 'Motorista',
        nPassageirosActivos: 3,
        refDate: refOct15,
      }),
    ).toBe(1900);
  });

  it('motorista: 3 activos e 1 falta Motorista 500 Kz → total 1500 Kz', () => {
    const faltas = [{ tipo: 'Motorista', desconto_kz: 500 }];
    expect(
      resolveDescontoFaltasTotal([], faltas, {
        tipoPerfil: 'Motorista',
        nPassageirosActivos: 3,
        refDate: refOct15,
      }),
    ).toBe(1500);
  });

  it('sumDescontoFaltasParaPassageiro inclui motorista e só o passageiro alvo', () => {
    const faltas = [
      { tipo: 'Passageiro', passenger_id: 'pax-1', desconto_kz: 400 },
      { tipo: 'Passageiro', passenger_id: 'pax-2', desconto_kz: 300 },
      { tipo: 'Motorista', desconto_kz: 500 },
    ];
    expect(sumDescontoFaltasParaPassageiro(faltas, 'pax-1')).toBe(900);
  });

  it('soma descontos como valores positivos', () => {
    const total = sumDescontoFaltas([
      { desconto_kz: 1272.73 },
      { desconto_kz: 636.36 },
    ]);

    expect(total).toBeCloseTo(1909.09, 2);
  });

  it('descontoMesReferenciaFalta usa coluna ou trunca data_falta ao mês', () => {
    expect(
      descontoMesReferenciaFalta({
        data_falta: '2026-09-08',
        desconto_mes_referencia: '2026-10-01',
      }),
    ).toBe('2026-10-01');
    expect(descontoMesReferenciaFalta({ data_falta: '2026-09-08' })).toBe('2026-09-01');
  });

  it('Total a descontar: agrupa por desconto_mes_referencia (Set creditada em Out)', () => {
    const faltas = [
      { id: 'set-no-out', data_falta: '2026-09-08', desconto_mes_referencia: '2026-10-01', desconto_kz: 1000 },
      { id: 'out-native', data_falta: '2026-10-02', desconto_kz: 500 },
      { id: 'set-only', data_falta: '2026-09-15', desconto_mes_referencia: '2026-09-01', desconto_kz: 800 },
    ];

    const outubro = filterFaltasDescontoMesAtual(faltas, refOct1);
    expect(outubro.map((f) => f.id)).toEqual(['set-no-out', 'out-native']);
    expect(sumDescontoFaltas(outubro)).toBe(1500);
  });

  it('devolve hoje em Luanda (YYYY-MM-DD)', () => {
    expect(todayLuandaISO(refOct1)).toBe('2026-10-01');
  });

  it('identifica datas futuras em Luanda', () => {
    expect(isFutureFaltaDate('2026-10-15', refOct1)).toBe(true);
    expect(isFutureFaltaDate('2026-10-01', refOct1)).toBe(false);
    expect(isFutureFaltaDate('2026-09-30', refOct1)).toBe(false);
  });

  it('formata o dia do histórico como no ecrã (2 Out)', () => {
    expect(formatFaltaDiaCurto('2026-10-02')).toBe('2 Out');
    expect(formatFaltaDiaCurto('2026-10-03')).toBe('3 Out');
  });

  it('mostra a rota do hub só com origem e destino reais', () => {
    const flexUmaPessoa = resolveFaltasHubCard({
      n_passageiros_contrato: 1,
      valor_mensal_por_passageiro_kz: 10000,
      ofertas_capacidade: { flexibilidade_rota: true, origin_name: null, destination_name: null },
    });
    expect(flexUmaPessoa.titulo).toBe('Acordo flexível · 1 pessoa');
    expect(flexUmaPessoa.rota).toBeNull();

    const fixoTres = resolveFaltasHubCard({
      n_passageiros_contrato: 3,
      valor_mensal_por_passageiro_kz: 8000,
      ofertas_capacidade: {
        flexibilidade_rota: false,
        origin_name: 'Viana',
        destination_name: 'Talatona',
      },
    });
    expect(fixoTres.titulo).toBe('Acordo fixo · 3 pessoas');
    expect(fixoTres.rota).toEqual({ origem: 'Viana', destino: 'Talatona' });

    const fixoUmaPessoa = resolveFaltasHubCard({
      n_passageiros_contrato: 1,
      valor_mensal_por_passageiro_kz: 5000,
      ofertas_capacidade: {
        flexibilidade_rota: false,
        origin_name: 'Kilamba',
        destination_name: 'Mutamba',
      },
    });
    expect(fixoUmaPessoa.titulo).toBe('Acordo fixo · 1 pessoa');
    expect(fixoUmaPessoa.rota).toEqual({ origem: 'Kilamba', destino: 'Mutamba' });

    const flexTres = resolveFaltasHubCard({
      n_passageiros_contrato: 3,
      valor_mensal_por_passageiro_kz: 9000,
      ofertas_capacidade: { flexibilidade_rota: true },
    });
    expect(flexTres.titulo).toBe('Acordo flexível · 3 pessoas');
    expect(flexTres.rota).toBeNull();
  });

  it('não inventa Origem ou Destino quando falta um dos lados', () => {
    const card = resolveFaltasHubCard({
      n_passageiros_contrato: 2,
      ofertas_capacidade: {
        flexibilidade_rota: false,
        origin_name: 'Viana',
        destination_name: '   ',
      },
    });
    expect(card.rota).toBeNull();
    expect(card.titulo).toBe('Acordo fixo · 2 pessoas');
  });
});
