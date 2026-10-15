import { describe, it, expect } from 'vitest';
import {
  LOG_FALTA_MSG_DIA_VIAGEM_SERVIDOR,
  LOG_FALTA_SQLSTATE_DIA_VIAGEM,
  LOG_FALTA_MSG_PRAZO_PASSAGEIRO,
  LOG_FALTA_SQLSTATE_PRAZO_PASSAGEIRO,
  mapLogFaltaError,
  mapLogFaltaErrorToast,
} from './logFaltaError.js';
import { getFriendlyErrorMessage } from './errorHandler.js';
import {
  FALTA_DATA_INLINE_ERRO_DIA,
  FALTA_SERVIDOR_ERRO_DIA,
} from '../copy/faltasLogAbsenceCopy.js';

describe('mapLogFaltaError', () => {
  it('mapeia BCF02 para a copy de prazo passageiro', () => {
    expect(
      mapLogFaltaError({
        code: LOG_FALTA_SQLSTATE_PRAZO_PASSAGEIRO,
        message: 'outro texto cru',
      }),
    ).toBe(LOG_FALTA_MSG_PRAZO_PASSAGEIRO);
  });

  it('mapeia BCF03 para erro inline aprovado', () => {
    expect(
      mapLogFaltaError({ code: LOG_FALTA_SQLSTATE_DIA_VIAGEM, message: 'cru' }),
    ).toBe(FALTA_DATA_INLINE_ERRO_DIA);
  });

  it('toast BCF03 usa copy de servidor aprovada', () => {
    expect(
      mapLogFaltaErrorToast({ code: LOG_FALTA_SQLSTATE_DIA_VIAGEM }),
    ).toBe(FALTA_SERVIDOR_ERRO_DIA);
    expect(getFriendlyErrorMessage({ code: LOG_FALTA_SQLSTATE_DIA_VIAGEM })).toBe(
      FALTA_SERVIDOR_ERRO_DIA,
    );
  });

  it('não devolve a copy de prazo para outros erros de log_falta', () => {
    const outros = [
      { code: 'P0001', message: 'Já não é possível registar esta falta. Só podes avisar até às 22:00 do dia anterior.' },
      { code: '42501', message: 'Sem permissão para registar faltas neste acordo.' },
      {
        code: 'P0001',
        message: 'Registo de faltas disponível após pagamento validado em custódia.',
      },
      { code: 'P0001', message: 'Não autenticado.' },
      { code: 'P0001', message: 'Passageiro não activo neste acordo.' },
    ];

    for (const err of outros) {
      expect(mapLogFaltaError(err)).toBeNull();
      expect(mapLogFaltaErrorToast(err)).toBeNull();
      expect(getFriendlyErrorMessage(err)).not.toBe(LOG_FALTA_MSG_PRAZO_PASSAGEIRO);
      expect(getFriendlyErrorMessage(err)).not.toBe(FALTA_SERVIDOR_ERRO_DIA);
    }
  });
});
