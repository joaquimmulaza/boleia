import { describe, it, expect } from 'vitest';
import {
  ADDRESS_INPUT_SURFACE_CLASS,
  ADDRESS_INPUT_DARK_BORDER,
  EDIT_PROCURA_SHEET_DARK_BG,
} from './addressInputSurface.js';
import { contrastRatio } from './colorContrast.js';

describe('addressInputSurface', () => {
  it('modo escuro usa token shadcn muted-foreground (não border-input)', () => {
    expect(ADDRESS_INPUT_SURFACE_CLASS).toMatch(/dark:border-muted-foreground/);
    expect(ADDRESS_INPUT_SURFACE_CLASS).not.toMatch(/dark:border-input/);
  });

  it('borda escuro ≥3:1 contra fundo slate-900 do sheet Editar procura', () => {
    const ratio = contrastRatio(ADDRESS_INPUT_DARK_BORDER, EDIT_PROCURA_SHEET_DARK_BG);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});
