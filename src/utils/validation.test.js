import { describe, expect, it } from 'vitest';
import { validateAngolaIban, validateTelefone } from './validation';

describe('validateTelefone', () => {
  it('aceita +2449XXXXXXXX', () => {
    expect(validateTelefone('+244923456789')).toBe(true);
  });

  it('rejeita número curto', () => {
    expect(validateTelefone('+24492345')).toBe(false);
  });
});

describe('validateAngolaIban', () => {
  it('aceita IBAN AO06 com 25 caracteres', () => {
    expect(validateAngolaIban('AO06004000000000000000000')).toBe(true);
  });

  it('rejeita IBAN sem prefixo AO06', () => {
    expect(validateAngolaIban('PT50000201231234567890154')).toBe(false);
  });

  it('ignora espaços', () => {
    expect(validateAngolaIban('AO06 0040 0000 0000 0000 0000 0')).toBe(true);
  });
});
