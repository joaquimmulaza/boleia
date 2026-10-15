import { describe, it, expect } from 'vitest';
import { formatKwanza } from '../utils/formatKwanza';
import {
  FALTA_MOTORISTA_CONTA_PLURAL,
  FALTA_MOTORISTA_CONTA_SINGULAR,
  formatFaltaMotoristaRepartidaConta,
} from './faltasMotoristaRepartidaConta';

describe('faltasMotoristaRepartidaConta', () => {
  it('plural (n≥2): «N passageiros · total Kz no total»', () => {
    expect(formatFaltaMotoristaRepartidaConta(3, 1500)).toBe(
      `3 passageiros · ${formatKwanza(1500)} Kz no total`,
    );
    expect(FALTA_MOTORISTA_CONTA_PLURAL).toContain('no total');
  });

  it('singular (n=1): «1 passageiro · total Kz» sem «no total»', () => {
    const linha = formatFaltaMotoristaRepartidaConta(1, 500);
    expect(linha).toBe(`1 passageiro · ${formatKwanza(500)} Kz`);
    expect(linha).not.toContain('no total');
    expect(FALTA_MOTORISTA_CONTA_SINGULAR).not.toContain('no total');
  });
});
