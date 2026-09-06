import { describe, it, expect } from 'vitest';
import { formatTime24h, formatIdaRegresso } from './formatTime.js';

describe('formatTime', () => {
  it('formata hora para HH:mm em 24h', () => {
    expect(formatTime24h('07:00:00')).toBe('07:00');
    expect(formatTime24h('17:30')).toBe('17:30');
    expect(formatTime24h('7:5')).toBe('07:05');
  });

  it('formatIdaRegresso mostra ida e regresso quando existem', () => {
    expect(formatIdaRegresso('07:00', '17:00')).toBe('07:00 → 17:00');
    expect(formatIdaRegresso('07:15:00', null)).toBe('07:15');
    expect(formatIdaRegresso(null, '17:00')).toBe('');
  });
});
