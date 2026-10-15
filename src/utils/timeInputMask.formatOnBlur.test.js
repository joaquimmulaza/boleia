import { describe, it, expect } from 'vitest';
import {
  formatTimeInputOnBlur,
  maskTimeInputRaw,
  normalizeTime24h,
} from './timeInputMask.js';

describe('timeInputMask — formatOnBlur e máscara sem 74:5', () => {
  it('formatTimeInputOnBlur: 745 → 07:45, 1745 → 17:45, 7 → 07:00', () => {
    expect(normalizeTime24h(formatTimeInputOnBlur('745'))).toBe('07:45');
    expect(normalizeTime24h(formatTimeInputOnBlur('1745'))).toBe('17:45');
    expect(normalizeTime24h(formatTimeInputOnBlur('7'))).toBe('07:00');
  });

  it('máscara ao digitar não insere dois pontos antes de 4 dígitos (evita 74:5)', () => {
    expect(maskTimeInputRaw('745')).toBe('745');
    expect(maskTimeInputRaw('1745')).toBe('17:45');
  });
});
