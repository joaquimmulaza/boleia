import { describe, it, expect } from 'vitest';
import {
  parseExploreSearchParams,
  buildExploreSearchQuery,
  hasExploreSearchLabels,
} from './exploreSearchParams';

describe('exploreSearchParams', () => {
  it('parseExploreSearchParams lê labels e coordenadas', () => {
    const params = new URLSearchParams(
      'origem=Talatona&destino=Centro&origem_lat=-8.9&origem_lng=13.2&destino_lat=-8.8&destino_lng=13.3',
    );
    expect(parseExploreSearchParams(params)).toEqual({
      origem: 'Talatona',
      destino: 'Centro',
      origin_lat: -8.9,
      origin_lng: 13.2,
      destination_lat: -8.8,
      destination_lng: 13.3,
    });
  });

  it('buildExploreSearchQuery gera query para navegação', () => {
    const q = buildExploreSearchQuery({
      origem: 'Viana',
      destino: 'Talatona',
      origin_lat: -8.91,
      origin_lng: 13.29,
      destination_lat: -8.92,
      destination_lng: 13.3,
    });
    expect(q).toBe(
      'origem=Viana&destino=Talatona&origem_lat=-8.91&origem_lng=13.29&destino_lat=-8.92&destino_lng=13.3',
    );
  });

  it('hasExploreSearchLabels detecta filtro por copy', () => {
    expect(hasExploreSearchLabels({ origem: 'A', destino: 'B' })).toBe(true);
    expect(hasExploreSearchLabels({ origem: 'A' })).toBe(false);
  });
});
