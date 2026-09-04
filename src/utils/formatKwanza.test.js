import { describe, it, expect } from 'vitest';
import { formatKwanza } from './formatKwanza';

describe('formatKwanza', () => {
  it('formata números com locale pt-PT', () => {
    expect(formatKwanza(25000)).toMatch(/25\s?000/);
  });
});
