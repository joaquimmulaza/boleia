import { describe, it, expect } from 'vitest';
import { formatUseFreeTextLabel } from './addressGeocoderCopy';

describe('addressGeocoderCopy', () => {
  it('formatUseFreeTextLabel usa aspas curvas', () => {
    expect(formatUseFreeTextLabel('Mutamba')).toBe('Usar “Mutamba”');
  });
});
