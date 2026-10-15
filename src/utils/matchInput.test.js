import { describe, it, expect } from 'vitest';
import { toOfertaMatchInput, toProcuraMatchInput } from './matchInput.js';

describe('matchInput', () => {
  it('toProcuraMatchInput: null lat permanece null (não 0)', () => {
    const input = toProcuraMatchInput({
      preferred_time: '07:00:00',
      origin_lat: null,
      origin_lng: null,
      destination_lat: null,
      destination_lng: null,
    });
    expect(input.preferred_time).toBe('07:00');
    expect(input.origin_lat).toBeNull();
    expect(input.destination_lat).toBeNull();
    expect(input.dias_semana).toBeNull();
  });

  it('toProcuraMatchInput: strings vazias em coords → null', () => {
    const input = toProcuraMatchInput({
      preferred_time: '08:30',
      origin_lat: '',
      origin_lng: '',
      destination_lat: '',
      destination_lng: '',
      dias_semana: [1, 2],
    });
    expect(input.origin_lat).toBeNull();
    expect(input.dias_semana).toEqual([1, 2]);
  });

  it('toOfertaMatchInput: flexível sem OD e hora truncada', () => {
    const input = toOfertaMatchInput({
      departure_time: '17:15:00',
      flexibilidade_rota: true,
      vagas_disponiveis: 2,
      origin_lat: null,
      destination_lat: null,
    });
    expect(input.departure_time).toBe('17:15');
    expect(input.flexibilidade_rota).toBe(true);
    expect(input.vagas_disponiveis).toBe(2);
    expect(input.origin_lat).toBeNull();
  });

  it('toOfertaMatchInput: coords numéricas em string convertem para Number', () => {
    const input = toOfertaMatchInput({
      departure_time: '07:00',
      flexibilidade_rota: false,
      vagas_disponiveis: 3,
      origin_lat: '-8.92',
      origin_lng: '13.18',
      destination_lat: '-8.81',
      destination_lng: '13.23',
      dias_semana: null,
    });
    expect(input.origin_lat).toBe(-8.92);
    expect(input.flexibilidade_rota).toBe(false);
    expect(input.dias_semana).toBeNull();
  });
});
