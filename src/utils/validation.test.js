import { describe, it, expect } from 'vitest';
import { validateTelefone, validatePassword } from './validation';

describe('Validation Utilities', () => {
  describe('validateTelefone', () => {
    it('returns true for valid Angola phone numbers', () => {
      expect(validateTelefone('912345678')).toBe(true);
      expect(validateTelefone('+244912345678')).toBe(true);
      expect(validateTelefone('+244 912 345 678')).toBe(true);
      expect(validateTelefone('912 345 678')).toBe(true);
    });

    it('returns false for invalid phone numbers', () => {
      expect(validateTelefone('')).toBe(false);
      expect(validateTelefone('12345678')).toBe(false); // too short
      expect(validateTelefone('812345678')).toBe(false); // does not start with 9
      expect(validateTelefone('+244812345678')).toBe(false);
      expect(validateTelefone('9123456789')).toBe(false); // too long
    });
  });

  describe('validatePassword', () => {
    it('returns true for passwords with 8 or more characters', () => {
      expect(validatePassword('12345678')).toBe(true);
      expect(validatePassword('password123')).toBe(true);
      expect(validatePassword('A Very Long Password')).toBe(true);
    });

    it('returns false for passwords with fewer than 8 characters', () => {
      expect(validatePassword('')).toBe(false);
      expect(validatePassword('1234567')).toBe(false);
      expect(validatePassword('short')).toBe(false);
    });
  });
});
