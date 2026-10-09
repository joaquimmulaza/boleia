import { describe, it, expect } from 'vitest';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import {
  estadoPassageiroParaChip,
  isActivoPassageiro,
  isReservadoPassageiro,
  isSaiuPassageiro,
  isExpiradoPassageiro,
  labelChipEstadoPassageiro,
  chipClassEstadoPassageiro,
  mostrarChipEstadoLugarPassageiro,
} from './estadoPassageiro.js';

describe('estadoPassageiro — chip por estado', () => {
  it('activo → Confirmado (nunca Activo no chip)', () => {
    expect(labelChipEstadoPassageiro('activo')).toBe('Confirmado');
    expect(labelChipEstadoPassageiro('activo')).not.toBe('Activo');
    expect(isActivoPassageiro('activo')).toBe(true);
    expect(mostrarChipEstadoLugarPassageiro('activo')).toBe(false);
  });

  it('reservado → Reservado', () => {
    expect(estadoPassageiroParaChip('reservado')).toBe('reservado');
    expect(labelChipEstadoPassageiro('reservado')).toBe('Reservado');
    expect(isReservadoPassageiro('reservado')).toBe(true);
    expect(mostrarChipEstadoLugarPassageiro('reservado')).toBe(true);
    expect(chipClassEstadoPassageiro('reservado')).toMatch(/amber/);
  });

  it('saiu → Saiu', () => {
    expect(estadoPassageiroParaChip('saiu')).toBe('saiu');
    expect(labelChipEstadoPassageiro('saiu')).toBe('Saiu');
    expect(isSaiuPassageiro('saiu')).toBe(true);
    expect(mostrarChipEstadoLugarPassageiro('saiu')).toBe(true);
  });

  it('expirado (TTL) → Expirado', () => {
    expect(
      labelChipEstadoPassageiro('expirado', {
        anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO,
      }),
    ).toBe('Expirado');
    expect(
      isExpiradoPassageiro('expirado', {
        anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO,
      }),
    ).toBe(true);
    expect(mostrarChipEstadoLugarPassageiro('expirado', {
      anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO,
    })).toBe(true);
  });

  it('legacy: expirado + saída voluntária → chip Saiu', () => {
    const pagamento = { anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO };
    expect(estadoPassageiroParaChip('expirado', pagamento)).toBe('saiu');
    expect(labelChipEstadoPassageiro('expirado', pagamento)).toBe('Saiu');
    expect(isExpiradoPassageiro('expirado', pagamento)).toBe(false);
    expect(isSaiuPassageiro('expirado', pagamento)).toBe(true);
  });
});
