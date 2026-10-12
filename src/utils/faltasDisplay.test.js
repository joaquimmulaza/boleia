import { describe, it, expect } from 'vitest';
import {
  filterFaltasEsteMes,
  sumDescontoFaltas,
  todayLuandaISO,
  isFutureFaltaDate,
  formatFaltaDiaCurto,
  resolveFaltasHubCard,
} from './faltasDisplay';

describe('faltasDisplay', () => {
  const refOct1 = new Date('2026-10-01T12:00:00Z');

  it('filtra faltas do mês corrente em Luanda até hoje (exclui futuras)', () => {
    const faltas = [
      { id: '1', data_falta: '2026-09-30', desconto_kz: 100 },
      { id: '2', data_falta: '2026-10-01', desconto_kz: 200 },
      { id: '3', data_falta: '2026-10-15', desconto_kz: 1272.73 },
      { id: '4', data_falta: '2026-11-01', desconto_kz: 50 },
    ];

    const esteMes = filterFaltasEsteMes(faltas, refOct1);

    expect(esteMes.map((f) => f.id)).toEqual(['2']);
  });

  it('soma descontos como valores positivos', () => {
    const total = sumDescontoFaltas([
      { desconto_kz: 1272.73 },
      { desconto_kz: 636.36 },
    ]);

    expect(total).toBeCloseTo(1909.09, 2);
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
