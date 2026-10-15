import { describe, it, expect } from 'vitest';
import {
  isBeforePassageiroPrazoCutoffLuanda,
  minDataFaltaPassageiroProprioLuanda,
  isPassageiroProprioFaltaDataSubmissivel,
} from './passageiroFaltaPrazo';

describe('passageiroFaltaPrazo — calendário própria vaga', () => {
  it('21:59 Luanda: amanhã é a primeira data activa', () => {
    const ref = new Date('2026-10-15T20:59:00Z');
    expect(isBeforePassageiroPrazoCutoffLuanda(ref)).toBe(true);
    expect(minDataFaltaPassageiroProprioLuanda(ref)).toBe('2026-10-16');
    expect(isPassageiroProprioFaltaDataSubmissivel('2026-10-16', ref)).toBe(true);
    expect(isPassageiroProprioFaltaDataSubmissivel('2026-10-15', ref)).toBe(false);
  });

  it('22:00 Luanda: amanhã desactivado, depois de amanhã activo', () => {
    const ref = new Date('2026-10-15T21:00:00Z');
    expect(isBeforePassageiroPrazoCutoffLuanda(ref)).toBe(false);
    expect(minDataFaltaPassageiroProprioLuanda(ref)).toBe('2026-10-17');
    expect(isPassageiroProprioFaltaDataSubmissivel('2026-10-16', ref)).toBe(false);
    expect(isPassageiroProprioFaltaDataSubmissivel('2026-10-17', ref)).toBe(true);
  });
});
