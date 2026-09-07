import { describe, it, expect } from 'vitest';
import { requiresWaitlist, resolveCapacityN } from './capacityGate.js';

describe('capacityGate', () => {
  describe('requiresWaitlist', () => {
    it('verdadeiro quando N_proposto > vagas', () => {
      expect(requiresWaitlist(3, 2)).toBe(true);
      expect(requiresWaitlist(2, 1)).toBe(true);
    });

    it('falso quando N_proposto <= vagas (aceite directo possível)', () => {
      expect(requiresWaitlist(2, 3)).toBe(false);
      expect(requiresWaitlist(1, 1)).toBe(false);
    });

    it('verdadeiro para entradas inválidas (fail-safe waitlist)', () => {
      expect(requiresWaitlist(0, 3)).toBe(true);
      expect(requiresWaitlist(2, -1)).toBe(true);
    });
  });

  describe('resolveCapacityN', () => {
    it('prioriza membros activos sobre n_candidato', () => {
      expect(resolveCapacityN({ n_candidato: 4, membrosActivos: 2 })).toBe(2);
    });

    it('usa n_candidato quando não há membros', () => {
      expect(resolveCapacityN({ n_candidato: 3, membrosActivos: 0 })).toBe(3);
    });

    it('fallback 1 para individual', () => {
      expect(resolveCapacityN({})).toBe(1);
    });
  });
});
