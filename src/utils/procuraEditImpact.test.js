import { describe, it, expect } from 'vitest';
import { countPropostasAInvalidar } from './procuraEditImpact.js';

const procuraTalatona = {
  preferred_time: '17:00',
  origin_lat: -8.92,
  origin_lng: 13.18,
  destination_lat: -8.81,
  destination_lng: 13.23,
  dias_semana: [1, 2, 3, 4, 5],
};

const ofertaFixa = {
  id: 'of-fixa',
  departure_time: '17:00',
  origin_lat: -8.92,
  origin_lng: 13.18,
  destination_lat: -8.81,
  destination_lng: 13.23,
  vagas_disponiveis: 3,
  flexibilidade_rota: false,
  dias_semana: [1, 2, 3, 4, 5],
};

const ofertaFlex = {
  id: 'of-flex',
  departure_time: '17:00',
  vagas_disponiveis: 3,
  flexibilidade_rota: true,
  dias_semana: [1, 2, 3, 4, 5],
};

describe('countPropostasAInvalidar', () => {
  it('teto / mesma OD-hora → 0 (não invalida)', () => {
    const n = countPropostasAInvalidar({
      propostas: [{ id: 'p1', estado: 'aberta', oferta_id: 'of-fixa' }],
      ofertasById: { 'of-fixa': ofertaFixa },
      procura: procuraTalatona,
      nCandidato: 1,
    });
    expect(n).toBe(0);
  });

  it('horário incompatível vs oferta fixa → 1', () => {
    const n = countPropostasAInvalidar({
      propostas: [{ id: 'p1', estado: 'aberta', oferta_id: 'of-fixa' }],
      ofertasById: { 'of-fixa': ofertaFixa },
      procura: { ...procuraTalatona, preferred_time: '08:00' },
      nCandidato: 1,
    });
    expect(n).toBe(1);
  });

  it('OD nova vs oferta fixa → 1', () => {
    const n = countPropostasAInvalidar({
      propostas: [{ id: 'p1', estado: 'aberta', oferta_id: 'of-fixa' }],
      ofertasById: { 'of-fixa': ofertaFixa },
      procura: {
        ...procuraTalatona,
        origin_lat: -8.5,
        origin_lng: 13.5,
        destination_lat: -8.4,
        destination_lng: 13.4,
      },
      nCandidato: 1,
    });
    expect(n).toBe(1);
  });

  it('OD nova vs oferta flexível → 0', () => {
    const n = countPropostasAInvalidar({
      propostas: [{ id: 'p1', estado: 'aberta', oferta_id: 'of-flex' }],
      ofertasById: { 'of-flex': ofertaFlex },
      procura: {
        ...procuraTalatona,
        origin_lat: -8.5,
        origin_lng: 13.5,
        destination_lat: -8.4,
        destination_lng: 13.4,
      },
      nCandidato: 1,
    });
    expect(n).toBe(0);
  });
});
