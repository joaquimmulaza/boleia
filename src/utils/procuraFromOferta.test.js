import { describe, it, expect } from 'vitest';
import { buildProcuraMinimaFromOferta } from './procuraFromOferta.js';

describe('buildProcuraMinimaFromOferta', () => {
  it('oferta fixa: copia OD, horário e dias da oferta', () => {
    const payload = buildProcuraMinimaFromOferta({
      id: 'of-1',
      flexibilidade_rota: false,
      origin_name: 'Talatona',
      origin_lat: -8.916,
      origin_lng: 13.234,
      destination_name: 'Miramar',
      destination_lat: -8.82,
      destination_lng: 13.25,
      departure_time: '07:15:00',
      dias_semana: [1, 2, 3, 4, 5],
    });

    expect(payload).toEqual({
      preferred_time: '07:15',
      origin_name: 'Talatona',
      origin_lat: -8.916,
      origin_lng: 13.234,
      destination_name: 'Miramar',
      destination_lat: -8.82,
      destination_lng: 13.25,
      dias_semana: [1, 2, 3, 4, 5],
      teto_mensal_kz: null,
    });
  });

  it('oferta flexível: sem OD inventada (null)', () => {
    const payload = buildProcuraMinimaFromOferta({
      id: 'of-flex',
      flexibilidade_rota: true,
      departure_time: '07:00:00',
      dias_semana: [1, 3, 5],
    });

    expect(payload.origin_name).toBeNull();
    expect(payload.origin_lat).toBeNull();
    expect(payload.origin_lng).toBeNull();
    expect(payload.destination_name).toBeNull();
    expect(payload.destination_lat).toBeNull();
    expect(payload.destination_lng).toBeNull();
    expect(payload.preferred_time).toBe('07:00');
    expect(payload.dias_semana).toEqual([1, 3, 5]);
  });

  it('usa default Seg–Sex quando dias_semana ausente', () => {
    const payload = buildProcuraMinimaFromOferta({
      flexibilidade_rota: true,
      departure_time: '08:30:00',
    });

    expect(payload.dias_semana).toEqual([1, 2, 3, 4, 5]);
  });

  it('oferta fixa sem coordenadas lança erro', () => {
    expect(() =>
      buildProcuraMinimaFromOferta({
        flexibilidade_rota: false,
        origin_name: 'Talatona',
        destination_name: 'Miramar',
        departure_time: '07:15:00',
      }),
    ).toThrow(/origem e destino/i);
  });
});
