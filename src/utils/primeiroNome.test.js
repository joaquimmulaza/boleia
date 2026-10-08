import { describe, it, expect } from 'vitest';
import { formatPrimeiroNome } from './primeiroNome';

describe('formatPrimeiroNome', () => {
  it('devolve o primeiro token do nome completo', () => {
    expect(formatPrimeiroNome('Ana Silva')).toBe('Ana');
    expect(formatPrimeiroNome('João Pedro Costa')).toBe('João');
  });

  it('fallback «Passageiro» quando vazio ou inválido', () => {
    expect(formatPrimeiroNome('')).toBe('Passageiro');
    expect(formatPrimeiroNome(null)).toBe('Passageiro');
    expect(formatPrimeiroNome('   ')).toBe('Passageiro');
  });

  it('trim antes de extrair', () => {
    expect(formatPrimeiroNome('  Maria  Santos ')).toBe('Maria');
  });
});
