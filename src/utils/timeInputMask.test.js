import { describe, it, expect } from 'vitest';
import {
  maskTimeInputRaw,
  isValidTime24h,
  normalizeTime24h,
  TIME_INPUT_INVALID_MESSAGE,
} from './timeInputMask.js';

describe('timeInputMask', () => {
  it('máscara HH:MM a partir de dígitos', () => {
    expect(maskTimeInputRaw('1')).toBe('1');
    expect(maskTimeInputRaw('17')).toBe('17');
    expect(maskTimeInputRaw('174')).toBe('174');
    expect(maskTimeInputRaw('1745')).toBe('17:45');
    expect(maskTimeInputRaw('17:45')).toBe('17:45');
  });

  it('valida intervalo 00:00–23:59', () => {
    expect(isValidTime24h('00:00')).toBe(true);
    expect(isValidTime24h('23:59')).toBe(true);
    expect(isValidTime24h('17:45')).toBe(true);
    expect(isValidTime24h('24:00')).toBe(false);
    expect(isValidTime24h('17:60')).toBe(false);
    expect(isValidTime24h('7:45')).toBe(true);
  });

  it('normaliza para HH:MM com zero à esquerda', () => {
    expect(normalizeTime24h('7:05')).toBe('07:05');
    expect(normalizeTime24h('17:45')).toBe('17:45');
    expect(normalizeTime24h('25:00')).toBe(null);
  });

  it('mensagem de erro em PT', () => {
    expect(TIME_INPUT_INVALID_MESSAGE).toMatch(/24h/);
  });
});
