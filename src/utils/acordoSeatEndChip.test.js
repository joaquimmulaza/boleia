import { describe, it, expect } from 'vitest';
import {
  labelChipFimLugar,
  resolveMotivoFimLugar,
} from './acordoSeatEndChip.js';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import {
  CHIP_LUGAR_RETIRADO,
  CHIP_LUGAR_SAiu_JUSTA_CAUSA,
  CHIP_LUGAR_RESERVA_EXPIRADA,
} from '../constants/acordoFollowup278Copy.js';

describe('acordoSeatEndChip — chips unificados P1-d', () => {
  it('justa causa passageiro', () => {
    expect(
      labelChipFimLugar(
        { estado: 'saiu', lugar_rescisao_modo: 'justa_causa' },
        null,
      ),
    ).toBe(CHIP_LUGAR_SAiu_JUSTA_CAUSA);
  });

  it('motorista retirou (lugar_saida_iniciador)', () => {
    expect(
      labelChipFimLugar(
        { estado: 'saiu', lugar_saida_iniciador: 'motorista' },
        null,
      ),
    ).toBe(CHIP_LUGAR_RETIRADO);
    expect(resolveMotivoFimLugar({ estado: 'saiu', lugar_saida_iniciador: 'motorista' })).toBe(
      'motorista_retirou',
    );
  });

  it('reserva expirada', () => {
    expect(
      labelChipFimLugar(
        { estado: 'expirado' },
        { anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO },
      ),
    ).toBe(CHIP_LUGAR_RESERVA_EXPIRADA);
  });

  it('saída voluntária', () => {
    expect(labelChipFimLugar({ estado: 'saiu' }, null)).toBe('Saiu');
  });
});
