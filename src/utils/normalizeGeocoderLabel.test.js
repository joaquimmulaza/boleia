import { describe, it, expect } from 'vitest';
import { normalizeGeocoderLabel } from './normalizeGeocoderLabel';

describe('normalizeGeocoderLabel', () => {
  it('colapsa espaços e ignora maiúsculas', () => {
    expect(normalizeGeocoderLabel('  Benfica,   Município  do Talatona  ')).toBe(
      'benfica, municipio do talatona',
    );
  });
});
