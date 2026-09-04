import { describe, it, expect } from 'vitest';
import {
  isTimeCompatible,
  isOriginWithinRadius,
  isDestinationWithinRadius,
  canAcceptDirectly,
  evaluateMatch,
} from './matchingFilters';
import {
  MATCH_TIME_TOLERANCE_MINUTES,
  MATCH_RADIUS_ORIGIN_METERS,
  MATCH_RADIUS_DESTINATION_METERS,
} from './matchingConfig';

describe('isTimeCompatible', () => {
  it('aceita diferença de 10 min (dentro da tolerância ±15)', () => {
    expect(isTimeCompatible('07:00', '07:10')).toBe(true);
    expect(isTimeCompatible('07:10', '07:00')).toBe(true);
  });

  it('rejeita diferença de 20 min (fora da tolerância ±15)', () => {
    expect(isTimeCompatible('07:00', '07:20')).toBe(false);
    expect(isTimeCompatible('07:20', '07:00')).toBe(false);
  });

  it('aceita diferença exacta no limite da tolerância (15 min)', () => {
    expect(isTimeCompatible('07:00', '07:15')).toBe(true);
  });

  it('respeita tolerância customizada', () => {
    expect(isTimeCompatible('07:00', '07:20', 20)).toBe(true);
    expect(isTimeCompatible('07:00', '07:20', 19)).toBe(false);
  });

  it('usa MATCH_TIME_TOLERANCE_MINUTES por omissão', () => {
    expect(MATCH_TIME_TOLERANCE_MINUTES).toBe(15);
    expect(isTimeCompatible('08:00', '08:15')).toBe(true);
    expect(isTimeCompatible('08:00', '08:16')).toBe(false);
  });
});

describe('isOriginWithinRadius / isDestinationWithinRadius', () => {
  // Ponto âncora ~Talatona / Luanda
  const a = { lat: -8.8383, lng: 13.2344 };
  // ~1 km a sul (dentro de 2500 m)
  const near = { lat: -8.8473, lng: 13.2344 };
  // ~5 km a sul (fora de 2500 m)
  const far = { lat: -8.8833, lng: 13.2344 };

  it('origem dentro do raio default é compatível', () => {
    expect(
      isOriginWithinRadius(a.lat, a.lng, near.lat, near.lng),
    ).toBe(true);
  });

  it('origem fora do raio default é incompatível', () => {
    expect(
      isOriginWithinRadius(a.lat, a.lng, far.lat, far.lng),
    ).toBe(false);
  });

  it('destino dentro/fora do raio default', () => {
    expect(
      isDestinationWithinRadius(a.lat, a.lng, near.lat, near.lng),
    ).toBe(true);
    expect(
      isDestinationWithinRadius(a.lat, a.lng, far.lat, far.lng),
    ).toBe(false);
  });

  it('respeita raios customizados e defaults exportados', () => {
    expect(MATCH_RADIUS_ORIGIN_METERS).toBe(2500);
    expect(MATCH_RADIUS_DESTINATION_METERS).toBe(2500);
    expect(
      isOriginWithinRadius(a.lat, a.lng, far.lat, far.lng, 6000),
    ).toBe(true);
  });
});

describe('canAcceptDirectly', () => {
  it('permite aceite directo quando N_candidato ≤ vagas', () => {
    expect(canAcceptDirectly(3, 3)).toBe(true);
    expect(canAcceptDirectly(1, 4)).toBe(true);
  });

  it('nega aceite directo quando N_candidato > vagas (waitlist)', () => {
    expect(canAcceptDirectly(3, 2)).toBe(false);
    expect(canAcceptDirectly(1, 0)).toBe(false);
  });
});

describe('evaluateMatch', () => {
  const baseOferta = {
    departure_time: '07:00',
    origin_lat: -8.8383,
    origin_lng: 13.2344,
    destination_lat: -8.85,
    destination_lng: 13.25,
    vagas_disponiveis: 3,
  };
  const baseProcura = {
    preferred_time: '07:10',
    origin_lat: -8.8473,
    origin_lng: 13.2344,
    destination_lat: -8.855,
    destination_lng: 13.255,
  };

  it('devolve direct quando tempo, geo e capacidade passam', () => {
    expect(
      evaluateMatch({
        oferta: baseOferta,
        procura: baseProcura,
        n_candidato: 2,
      }),
    ).toBe('direct');
  });

  it('devolve waitlist quando tempo+geo ok mas N_candidato > vagas', () => {
    expect(
      evaluateMatch({
        oferta: { ...baseOferta, vagas_disponiveis: 1 },
        procura: baseProcura,
        n_candidato: 3,
      }),
    ).toBe('waitlist');
  });

  it('devolve incompatible quando horário está fora (±20 min)', () => {
    expect(
      evaluateMatch({
        oferta: baseOferta,
        procura: { ...baseProcura, preferred_time: '07:20' },
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });

  it('devolve incompatible quando origem está fora do raio', () => {
    expect(
      evaluateMatch({
        oferta: baseOferta,
        procura: {
          ...baseProcura,
          preferred_time: '07:05',
          origin_lat: -8.8833,
          origin_lng: 13.2344,
        },
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });
});
