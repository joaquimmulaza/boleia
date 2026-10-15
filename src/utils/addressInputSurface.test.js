import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  ADDRESS_INPUT_SURFACE_CLASS,
  EDIT_PROCURA_SHEET_DARK_BG,
} from './addressInputSurface.js';
import { contrastRatio } from './colorContrast.js';

/**
 * @param {string} css
 * @param {string} varName
 * @returns {string}
 */
function readDarkThemeVar(css, varName) {
  const darkBlock = css.match(/\.dark\s*\{([^}]+)\}/s)?.[1] ?? '';
  const match = darkBlock.match(new RegExp(`--${varName}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) {
    throw new Error(`Variável --${varName} em .dark não encontrada`);
  }
  return match[1];
}

describe('addressInputSurface', () => {
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

  it('modo escuro usa token shadcn muted-foreground (não border-input)', () => {
    expect(ADDRESS_INPUT_SURFACE_CLASS).toMatch(/dark:border-muted-foreground/);
    expect(ADDRESS_INPUT_SURFACE_CLASS).not.toMatch(/dark:border-input/);
  });

  it('borda escuro ≥3:1 contra fundo slate-900 do sheet Editar procura', () => {
    const borderHex = readDarkThemeVar(indexCss, 'muted-foreground');
    const ratio = contrastRatio(borderHex, EDIT_PROCURA_SHEET_DARK_BG);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});
