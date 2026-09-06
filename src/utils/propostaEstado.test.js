import { describe, it, expect } from 'vitest';
import {
  labelEstadoProposta,
  chipEstadoProposta,
  isPropostaTerminada,
} from './propostaEstado';

describe('labelEstadoProposta', () => {
  it('aberta na secção enviadas → Aguarda resposta', () => {
    expect(labelEstadoProposta('aberta', { secao: 'enviadas' })).toBe('Aguarda resposta');
  });

  it('aberta na secção recebidas → Por responder', () => {
    expect(labelEstadoProposta('aberta', { secao: 'recebidas' })).toBe('Por responder');
  });

  it('rejeitada e cancelada com copy fixa', () => {
    expect(labelEstadoProposta('rejeitada')).toBe('Rejeitada');
    expect(labelEstadoProposta('cancelada')).toBe('Cancelada');
  });
});

describe('chipEstadoProposta', () => {
  it('devolve chip para estados conhecidos', () => {
    expect(chipEstadoProposta('rejeitada')?.label).toBe('Rejeitada');
    expect(chipEstadoProposta('cancelada')?.label).toBe('Cancelada');
  });
});

describe('isPropostaTerminada', () => {
  it('identifica rejeitada e cancelada', () => {
    expect(isPropostaTerminada('rejeitada')).toBe(true);
    expect(isPropostaTerminada('cancelada')).toBe(true);
    expect(isPropostaTerminada('aberta')).toBe(false);
  });
});
