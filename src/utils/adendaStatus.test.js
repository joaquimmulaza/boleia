import { describe, it, expect } from 'vitest';
import { labelChipAdenda, chipClassAdenda, formatMesAdendaPt } from './adendaStatus.js';

describe('adendaStatus', () => {
  it('labelChipAdenda — pendente: à espera tua vs deles', () => {
    expect(
      labelChipAdenda('pendente_passageiro', { isPassageiro: true }),
    ).toBe('À espera tua');
    expect(
      labelChipAdenda('pendente_passageiro', { isMotorista: true }),
    ).toBe('À espera deles');
    expect(
      labelChipAdenda('pendente_contraparte', { isMotorista: true }),
    ).toBe('À espera tua');
    expect(
      labelChipAdenda('pendente_contraparte', { isPassageiro: true }),
    ).toBe('À espera deles');
  });

  it('labelChipAdenda — aceite vigora em mês', () => {
    expect(
      labelChipAdenda('aceite_agendada', { effectiveFrom: '2026-10-01' }),
    ).toMatch(/Aceite vigora em outubro de 2026/i);
  });

  it('labelChipAdenda — estados terminais', () => {
    expect(labelChipAdenda('rejeitada')).toBe('Rejeitada');
    expect(labelChipAdenda('cancelada_substituta')).toBe('Substituída');
    expect(labelChipAdenda('em_vigor')).toBe('Em vigor');
  });

  it('chipClassAdenda devolve classes por estado', () => {
    expect(chipClassAdenda('pendente_passageiro')).toMatch(/amber/);
    expect(chipClassAdenda('aceite_agendada')).toMatch(/sky/);
    expect(chipClassAdenda('rejeitada')).toMatch(/red/);
    expect(chipClassAdenda('em_vigor')).toMatch(/emerald/);
  });

  it('formatMesAdendaPt formata mês em pt-PT', () => {
    expect(formatMesAdendaPt('2026-10-01')).toMatch(/outubro de 2026/i);
  });
});
