import { describe, it, expect } from 'vitest';
import { formatFaltaMotoristaRepartidaConta } from './faltasMotoristaRepartidaConta';

describe('faltasMotoristaRepartidaConta', () => {
  it('formata placeholder da conta (3 passageiros · 1500 Kz)', () => {
    expect(formatFaltaMotoristaRepartidaConta(3, '1500')).toBe('3 passageiros · 1500 Kz');
  });
});
