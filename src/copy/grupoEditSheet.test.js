import { describe, it, expect } from 'vitest';
import { GRUPO_EDIT_SHEET_SUBTITLE, getGrupoEditSheetSubtitle } from './grupoEditSheet';

describe('grupoEditSheet', () => {
  it('subtítulo H6a aprovado sem jargon snapshots', () => {
    expect(getGrupoEditSheetSubtitle()).toBe(GRUPO_EDIT_SHEET_SUBTITLE);
    expect(GRUPO_EDIT_SHEET_SUBTITLE).toMatch(/propostas que já enviaste/i);
    expect(GRUPO_EDIT_SHEET_SUBTITLE.toLowerCase()).not.toContain('snapshot');
  });
});
