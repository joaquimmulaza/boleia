import { describe, expect, it } from 'vitest';
import { contrastRatio, LIGHT_INPUT_BORDER, LIGHT_INPUT_SURFACE } from './colorContrast';

describe('colorContrast — tokens Input em sheet claro', () => {
  it('borda --input vs fundo card branco atinge ≥ 3:1 (UI components)', () => {
    const ratio = contrastRatio(LIGHT_INPUT_BORDER, LIGHT_INPUT_SURFACE);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('combinação smoke antiga (fundo #f6f8f6 + borda #e2e8f0) falha o mínimo', () => {
    const ratio = contrastRatio('#e2e8f0', '#f6f8f6');
    expect(ratio).toBeLessThan(3);
  });
});
