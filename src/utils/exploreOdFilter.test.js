import { describe, it, expect } from 'vitest';
import { filterOfertasBySearchOd, isSearchOdActive } from './exploreOdFilter';

const searchTalatonaCentro = {
  origin_lat: -8.916,
  origin_lng: 13.234,
  destination_lat: -8.809,
  destination_lng: 13.234,
};

describe('exploreOdFilter', () => {
  it('isSearchOdActive exige quatro coordenadas finitas', () => {
    expect(isSearchOdActive(searchTalatonaCentro)).toBe(true);
    expect(isSearchOdActive({ origin_lat: 1 })).toBe(false);
    expect(isSearchOdActive(null)).toBe(false);
  });

  it('exclui ofertas flexíveis e sem OD completo', () => {
    const ofertas = [
      {
        id: 'flex',
        flexibilidade_rota: true,
        origin_lat: -8.916,
        origin_lng: 13.234,
        destination_lat: -8.809,
        destination_lng: 13.234,
      },
      {
        id: 'sem-od',
        flexibilidade_rota: false,
        origin_lat: null,
        origin_lng: 13.234,
        destination_lat: -8.809,
        destination_lng: 13.234,
      },
    ];

    expect(filterOfertasBySearchOd(ofertas, searchTalatonaCentro)).toEqual([]);
  });

  it('mantém oferta fixa quando origem e destino caem no raio de 2500 m', () => {
    const match = {
      id: 'ok',
      flexibilidade_rota: false,
      origin_lat: -8.9161,
      origin_lng: 13.2341,
      destination_lat: -8.8091,
      destination_lng: 13.2341,
    };
    const far = {
      id: 'longe',
      flexibilidade_rota: false,
      origin_lat: -9.5,
      origin_lng: 13.234,
      destination_lat: -8.809,
      destination_lng: 13.234,
    };

    expect(filterOfertasBySearchOd([match, far], searchTalatonaCentro).map((o) => o.id)).toEqual(['ok']);
  });

  it('sem pesquisa activa devolve a lista intacta', () => {
    const ofertas = [{ id: 'a', flexibilidade_rota: true }];
    expect(filterOfertasBySearchOd(ofertas, null)).toBe(ofertas);
  });
});
