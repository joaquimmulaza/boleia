import { describe, it, expect } from 'vitest';
import {
  FALTA_DATA_HELP_MOTORISTA,
  FALTA_DATA_HELP_PASSAGEIRO,
  FALTA_DATA_INLINE_ERRO_DIA,
  FALTA_SERVIDOR_ERRO_DIA,
} from './faltasLogAbsenceCopy.js';

describe('faltasLogAbsenceCopy — strings aprovadas', () => {
  it('help motorista', () => {
    expect(FALTA_DATA_HELP_MOTORISTA).toBe(
      'Só podes escolher dias de viagem do acordo.',
    );
  });

  it('help passageiro', () => {
    expect(FALTA_DATA_HELP_PASSAGEIRO).toBe(
      'Só dias de viagem do acordo. Avisa até às 22:00 do dia anterior.',
    );
  });

  it('erro inline', () => {
    expect(FALTA_DATA_INLINE_ERRO_DIA).toBe(
      'Neste dia não há viagem no acordo. Escolhe outro dia.',
    );
  });

  it('toast servidor', () => {
    expect(FALTA_SERVIDOR_ERRO_DIA).toBe(
      'Não foi possível registar a falta. Neste dia não há viagem no acordo.',
    );
  });
});
