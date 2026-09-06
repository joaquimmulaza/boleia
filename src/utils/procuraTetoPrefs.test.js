import { describe, it, expect, beforeEach } from 'vitest';
import { getModoTetoPreferido, setModoTetoPreferido } from './procuraTetoPrefs';

describe('procuraTetoPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devolve POR_PASSAGEIRO por defeito', () => {
    expect(getModoTetoPreferido()).toBe('POR_PASSAGEIRO');
  });

  it('persiste e lê TOTAL_ACORDO', () => {
    setModoTetoPreferido('TOTAL_ACORDO');
    expect(getModoTetoPreferido()).toBe('TOTAL_ACORDO');
  });

  it('ignora valores inválidos ao gravar', () => {
    setModoTetoPreferido('INVALIDO');
    expect(getModoTetoPreferido()).toBe('POR_PASSAGEIRO');
  });
});
