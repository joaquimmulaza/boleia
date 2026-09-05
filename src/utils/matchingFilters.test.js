import { describe, it, expect } from 'vitest';
import {
  isTimeCompatible,
  isOriginWithinRadius,
  isDestinationWithinRadius,
  canAcceptDirectly,
  isDaysCompatible,
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

describe('isDaysCompatible', () => {
  it('rejeita quando um dos lados não tem dias (exige intersecção real)', () => {
    expect(isDaysCompatible([1, 2, 3, 4, 5], null)).toBe(false);
    expect(isDaysCompatible(undefined, [1, 2])).toBe(false);
    expect(isDaysCompatible([], [1])).toBe(false);
  });

  it('aceita quando há intersecção de dias', () => {
    expect(isDaysCompatible([1, 2, 3], [3, 4])).toBe(true);
  });

  it('rejeita quando ambos têm dias e não há intersecção', () => {
    expect(isDaysCompatible([1, 2], [4, 5])).toBe(false);
  });

  it('rejeita quando ambos os lados estão vazios ou ausentes', () => {
    expect(isDaysCompatible([], [])).toBe(false);
    expect(isDaysCompatible(null, undefined)).toBe(false);
  });

  it('normaliza dias vindos como string (JSON/BD) na intersecção', () => {
    expect(isDaysCompatible(['1', '2'], [2, 3])).toBe(true);
    expect(isDaysCompatible(['1'], ['4'])).toBe(false);
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
    flexibilidade_rota: false,
    dias_semana: [1, 2, 3, 4, 5],
  };
  const baseProcura = {
    preferred_time: '07:10',
    origin_lat: -8.8473,
    origin_lng: 13.2344,
    destination_lat: -8.855,
    destination_lng: 13.255,
    dias_semana: [1, 2, 3, 4, 5],
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

  it('devolve incompatible quando origem está fora do raio (oferta fixa)', () => {
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

  it('oferta flexível: casa por tempo+capacidade sem OD (mesmo com procura longe)', () => {
    expect(
      evaluateMatch({
        oferta: {
          departure_time: '07:00',
          flexibilidade_rota: true,
          vagas_disponiveis: 3,
          dias_semana: [1, 2, 3, 4, 5],
          origin_lat: null,
          origin_lng: null,
          destination_lat: null,
          destination_lng: null,
        },
        procura: {
          preferred_time: '07:10',
          origin_lat: -8.95,
          origin_lng: 13.1,
          destination_lat: -8.9,
          destination_lng: 13.15,
          dias_semana: [1, 2, 3, 4, 5],
        },
        n_candidato: 2,
      }),
    ).toBe('direct');
  });

  it('oferta flexível: waitlist quando N > vagas (sem filtro geo)', () => {
    expect(
      evaluateMatch({
        oferta: {
          departure_time: '07:00',
          flexibilidade_rota: true,
          vagas_disponiveis: 1,
          dias_semana: [1, 2, 3, 4, 5],
        },
        procura: {
          preferred_time: '07:05',
          origin_lat: -8.95,
          origin_lng: 13.1,
          destination_lat: -8.9,
          destination_lng: 13.15,
          dias_semana: [1, 2, 3, 4, 5],
        },
        n_candidato: 3,
      }),
    ).toBe('waitlist');
  });

  it('oferta flexível: incompatible se horário fora da tolerância', () => {
    expect(
      evaluateMatch({
        oferta: {
          departure_time: '07:00',
          flexibilidade_rota: true,
          vagas_disponiveis: 4,
        },
        procura: {
          preferred_time: '08:00',
          origin_lat: -8.85,
          origin_lng: 13.23,
          destination_lat: -8.86,
          destination_lng: 13.24,
        },
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });

  it('oferta flexível: incompatible se dias sem intersecção', () => {
    expect(
      evaluateMatch({
        oferta: {
          departure_time: '07:00',
          flexibilidade_rota: true,
          vagas_disponiveis: 4,
          dias_semana: [1, 2],
        },
        procura: {
          preferred_time: '07:05',
          dias_semana: [5, 6],
          origin_lat: -8.85,
          origin_lng: 13.23,
          destination_lat: -8.86,
          destination_lng: 13.24,
        },
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });

  it('oferta fixa continua a exigir geo mesmo com dias ok', () => {
    expect(
      evaluateMatch({
        oferta: {
          ...baseOferta,
          flexibilidade_rota: false,
          dias_semana: [1, 2, 3, 4, 5],
        },
        procura: {
          ...baseProcura,
          preferred_time: '07:05',
          origin_lat: -8.8833,
          origin_lng: 13.2344,
          dias_semana: [1, 2, 3],
        },
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });

  it('oferta fixa: incompatible quando OD da oferta está incompleto (evita falso positivo em 0,0)', () => {
    expect(
      evaluateMatch({
        oferta: {
          ...baseOferta,
          origin_lat: null,
          origin_lng: null,
          destination_lat: null,
          destination_lng: null,
        },
        procura: baseProcura,
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });

  it('oferta fixa: incompatible quando só o destino está fora do raio', () => {
    expect(
      evaluateMatch({
        oferta: baseOferta,
        procura: {
          ...baseProcura,
          preferred_time: '07:05',
          destination_lat: -8.92,
          destination_lng: 13.25,
        },
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });

  it('oferta fixa: incompatible quando dias sem intersecção (mesmo com tempo+geo ok)', () => {
    expect(
      evaluateMatch({
        oferta: { ...baseOferta, dias_semana: [1, 2] },
        procura: { ...baseProcura, dias_semana: [6, 7] },
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });

  it('oferta fixa: procura sem dias é incompatível (exige intersecção real)', () => {
    expect(
      evaluateMatch({
        oferta: { ...baseOferta, dias_semana: [1, 2, 3, 4, 5] },
        procura: { ...baseProcura, dias_semana: null },
        n_candidato: 2,
      }),
    ).toBe('incompatible');
  });

  it('oferta fixa: oferta sem dias é incompatível', () => {
    expect(
      evaluateMatch({
        oferta: { ...baseOferta, dias_semana: [] },
        procura: { ...baseProcura, dias_semana: [1, 2, 3, 4, 5] },
        n_candidato: 1,
      }),
    ).toBe('incompatible');
  });

  it('capacidade: N_actual igual a vagas → direct; N_actual = vagas+1 → waitlist', () => {
    expect(
      evaluateMatch({
        oferta: { ...baseOferta, vagas_disponiveis: 3 },
        procura: baseProcura,
        n_candidato: 3,
      }),
    ).toBe('direct');
    expect(
      evaluateMatch({
        oferta: { ...baseOferta, vagas_disponiveis: 3 },
        procura: baseProcura,
        n_candidato: 4,
      }),
    ).toBe('waitlist');
  });

  it('oferta flexível: ignora OD/residência mesmo com coords longe na oferta (sem falso negativo)', () => {
    expect(
      evaluateMatch({
        oferta: {
          departure_time: '07:00',
          flexibilidade_rota: true,
          vagas_disponiveis: 3,
          dias_semana: [1, 2, 3, 4, 5],
          // coords residuais / legado — NÃO devem restringir
          origin_lat: -9.5,
          origin_lng: 13.0,
          destination_lat: -9.6,
          destination_lng: 13.1,
        },
        procura: {
          preferred_time: '07:10',
          origin_lat: -8.8383,
          origin_lng: 13.2344,
          destination_lat: -8.85,
          destination_lng: 13.25,
          dias_semana: [1, 3],
        },
        n_candidato: 2,
      }),
    ).toBe('direct');
  });
});
