import { describe, it, expect } from 'vitest';
import {
  isActivoPassageiro,
  isReservadoPassageiro,
  isExpiradoPassageiro,
  countPassageirosConfirmadosReservados,
  formatContagemPassageiros,
  labelChipEstadoPassageiro,
  chipClassEstadoPassageiro,
  helpGlossarioReservado,
  helpGlossarioConfirmado,
  helpGlossarioEmCustodia,
  GLOSSARIO_ESTADOS_LUGAR,
} from './acordoPassageiroStatus.js';

describe('acordoPassageiroStatus — piloto reservado', () => {
  it('isActivoPassageiro e isReservadoPassageiro', () => {
    expect(isActivoPassageiro('activo')).toBe(true);
    expect(isActivoPassageiro('Activo')).toBe(true);
    expect(isReservadoPassageiro('reservado')).toBe(true);
    expect(isReservadoPassageiro('RESERVADO')).toBe(true);
    expect(isActivoPassageiro('reservado')).toBe(false);
    expect(isReservadoPassageiro('activo')).toBe(false);
  });

  it('countPassageirosConfirmadosReservados ignora saiu', () => {
    const linhas = [
      { estado: 'activo' },
      { estado: 'reservado' },
      { estado: 'reservado' },
      { estado: 'saiu' },
    ];
    expect(countPassageirosConfirmadosReservados(linhas)).toEqual({
      confirmados: 1,
      reservados: 2,
    });
  });

  it('formatContagemPassageiros — linha Confirmados · Reservados', () => {
    expect(formatContagemPassageiros(2, 1)).toBe('Confirmados 2 · Reservados 1');
    expect(formatContagemPassageiros(0, 3)).toBe('Confirmados 0 · Reservados 3');
  });

  it('isExpiradoPassageiro distingue TTL expirado', () => {
    expect(isExpiradoPassageiro('expirado')).toBe(true);
    expect(isExpiradoPassageiro('reservado')).toBe(false);
  });

  it('labelChipEstadoPassageiro — labels humanas', () => {
    expect(labelChipEstadoPassageiro('activo')).toBe('Confirmado');
    expect(labelChipEstadoPassageiro('reservado')).toBe('Reservado');
    expect(labelChipEstadoPassageiro('expirado')).toBe('Expirado');
    expect(labelChipEstadoPassageiro('saiu')).toBe('Saiu');
  });

  it('chipClassEstadoPassageiro — âmbar para reservado', () => {
    expect(chipClassEstadoPassageiro('reservado')).toMatch(/amber/);
    expect(chipClassEstadoPassageiro('activo')).toMatch(/emerald/);
    expect(chipClassEstadoPassageiro('saiu')).toMatch(/slate/);
  });

  it('glossário curto Reservado / Confirmado / Em custódia', () => {
    expect(helpGlossarioReservado()).toMatch(/pagamento/i);
    expect(helpGlossarioConfirmado()).toMatch(/confirmad/i);
    expect(helpGlossarioEmCustodia()).toMatch(/custódia/i);
    expect(GLOSSARIO_ESTADOS_LUGAR).toHaveLength(3);
    expect(GLOSSARIO_ESTADOS_LUGAR.map((g) => g.termo)).toEqual([
      'Reservado',
      'Confirmado',
      'Em custódia',
    ]);
  });
});
