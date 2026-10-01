import { describe, it, expect } from 'vitest';
import { buildOfertaMinimaFromProcura, getPropostaDriverGaps } from './ofertaFromProcura.js';

describe('ofertaFromProcura', () => {
  const procuraBase = {
    id: 'pr-1',
    preferred_time: '07:30:00',
    return_time: '18:00:00',
    dias_semana: [1, 2, 3, 4, 5],
    origin_name: 'Talatona',
    origin_lat: -8.9,
    origin_lng: 13.2,
    destination_name: 'Miramar',
    destination_lat: -8.8,
    destination_lng: 13.3,
    n_candidato: 2,
  };

  describe('buildOfertaMinimaFromProcura', () => {
    it('cria oferta flexível sem OD inventada, com horário e dias da procura', () => {
      const oferta = buildOfertaMinimaFromProcura(procuraBase, {
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 45000,
      });

      expect(oferta.flexibilidade_rota).toBe(true);
      expect(oferta.origin_name).toBeNull();
      expect(oferta.origin_lat).toBeNull();
      expect(oferta.destination_name).toBeNull();
      expect(oferta.departure_time).toBe('07:30');
      expect(oferta.return_time).toBe('18:00');
      expect(oferta.dias_semana).toEqual([1, 2, 3, 4, 5]);
      expect(oferta.modo_preco).toBe('POR_PASSAGEIRO');
      expect(oferta.valor_mensal_ask_kz).toBe(45000);
    });

    it('exige horário e valor válido', () => {
      expect(() =>
        buildOfertaMinimaFromProcura(
          { ...procuraBase, preferred_time: '' },
          { modo_preco: 'POR_PASSAGEIRO', valor_mensal_ask_kz: 45000 },
        ),
      ).toThrow(/horário/i);

      expect(() =>
        buildOfertaMinimaFromProcura(procuraBase, {
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 0,
        }),
      ).toThrow(/valor/i);
    });

    it('aceita preferred_time override do sheet', () => {
      const oferta = buildOfertaMinimaFromProcura(procuraBase, {
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        departure_time: '08:15',
      });
      expect(oferta.departure_time).toBe('08:15');
      expect(oferta.modo_preco).toBe('TOTAL_ACORDO');
    });
  });

  describe('getPropostaDriverGaps', () => {
    it('sem oferta activa pede valor (não OD)', () => {
      expect(getPropostaDriverGaps(null)).toEqual(['valor']);
      expect(getPropostaDriverGaps({ valor_mensal_ask_kz: 10000 })).toEqual([]);
    });
  });
});
