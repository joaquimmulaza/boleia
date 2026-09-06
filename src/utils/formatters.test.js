import { describe, it, expect } from 'vitest';
import { formatDate } from './formatters';

describe('Formatters Utilities', () => {
  describe('formatDate', () => {
    it('formata uma data válida corretamente no padrão "dd de Mes"', () => {
      expect(formatDate('2023-10-15')).toBe('15 de Outubro');
      expect(formatDate('2023-01-01')).toBe('01 de Janeiro');
      expect(formatDate('2023-12-31')).toBe('31 de Dezembro');
    });

    it('retorna string vazia para entrada vazia ou nula', () => {
      expect(formatDate('')).toBe('');
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });

    it('retorna a própria string se a data for inválida', () => {
      const invalidDate = 'not-a-date';
      expect(formatDate(invalidDate)).toBe(invalidDate);
    });

    it('mapeia todos os meses corretamente', () => {
      const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      months.forEach((month, index) => {
        const dateStr = `2023-${(index + 1).toString().padStart(2, '0')}-01`;
        expect(formatDate(dateStr)).toContain(month);
      });
    });
  });
});
