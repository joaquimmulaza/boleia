import { describe, it, expect } from 'vitest';
import { countPropostasAInvalidarPorOferta } from './ofertaEditImpact.js';

describe('countPropostasAInvalidarPorOferta', () => {
  const procuraFixa = {
    id: 'pr-1',
    preferred_time: '07:00',
    origin_lat: -8.9,
    origin_lng: 13.2,
    destination_lat: -8.8,
    destination_lng: 13.23,
    n_candidato: 1,
    dias_semana: [1, 2, 3, 4, 5],
  };

  const ofertaFixaCompat = {
    departure_time: '07:05',
    origin_lat: -8.901,
    origin_lng: 13.201,
    destination_lat: -8.801,
    destination_lng: 13.231,
    vagas_disponiveis: 3,
    flexibilidade_rota: false,
    dias_semana: [1, 2, 3, 4, 5],
  };

  it('conta propostas abertas que ficam incompatíveis após mudança de horário', () => {
    const n = countPropostasAInvalidarPorOferta({
      propostas: [{ id: 'p1', estado: 'aberta', procura_id: 'pr-1', n_passageiros_propostos: 1 }],
      procurasById: { 'pr-1': procuraFixa },
      oferta: { ...ofertaFixaCompat, departure_time: '09:00' },
    });
    expect(n).toBe(1);
  });

  it('ignora propostas não abertas e mantém compatíveis a zero', () => {
    expect(
      countPropostasAInvalidarPorOferta({
        propostas: [{ id: 'p1', estado: 'aceite', procura_id: 'pr-1' }],
        procurasById: { 'pr-1': procuraFixa },
        oferta: { ...ofertaFixaCompat, departure_time: '09:00' },
      }),
    ).toBe(0);

    expect(
      countPropostasAInvalidarPorOferta({
        propostas: [{ id: 'p1', estado: 'aberta', procura_id: 'pr-1' }],
        procurasById: { 'pr-1': procuraFixa },
        oferta: ofertaFixaCompat,
      }),
    ).toBe(0);
  });

  it('oferta flexível: mudança de horário incompatível invalida preview', () => {
    const procura = { ...procuraFixa, preferred_time: '07:00' };
    const n = countPropostasAInvalidarPorOferta({
      propostas: [{ id: 'p1', estado: 'aberta', procura_id: 'pr-1' }],
      procurasById: { 'pr-1': procura },
      oferta: {
        departure_time: '10:00',
        flexibilidade_rota: true,
        vagas_disponiveis: 2,
        dias_semana: [1, 2, 3, 4, 5],
      },
    });
    expect(n).toBe(1);
  });
});
