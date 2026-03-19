import { describe, it, expect } from 'vitest';
import { formatDate, formatCurrency } from './formatters';

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

  describe('formatCurrency', () => {
    it('adiciona pontos como separadores de milhar', () => {
      expect(formatCurrency(1000)).toBe('1.000');
      expect(formatCurrency(1000000)).toBe('1.000.000');
      expect(formatCurrency(1500)).toBe('1.500');
    });

    it('mantém números pequenos sem alteração', () => {
      expect(formatCurrency(100)).toBe('100');
      expect(formatCurrency(0)).toBe('0');
    });

    it('lida com strings numéricas', () => {
      expect(formatCurrency('2500')).toBe('2.500');
    });
  });
});
