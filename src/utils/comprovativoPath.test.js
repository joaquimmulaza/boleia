import { describe, it, expect } from 'vitest';
import { basenameComprovativoPath } from './comprovativoPath.js';

describe('basenameComprovativoPath', () => {
  it('devolve o último segmento do path', () => {
    expect(basenameComprovativoPath('uid/pag-1/comprovativo.pdf')).toBe('comprovativo.pdf');
  });

  it('devolve null para path vazio', () => {
    expect(basenameComprovativoPath('')).toBeNull();
    expect(basenameComprovativoPath(null)).toBeNull();
  });
});
