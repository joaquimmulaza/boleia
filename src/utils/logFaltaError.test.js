import { describe, it, expect } from 'vitest';
import {
  LOG_FALTA_MSG_PRAZO_PASSAGEIRO,
  LOG_FALTA_SQLSTATE_PRAZO_PASSAGEIRO,
  mapLogFaltaError,
} from './logFaltaError.js';
import { getFriendlyErrorMessage } from './errorHandler.js';

describe('mapLogFaltaError', () => {
  it('mapeia BCF02 para a copy de prazo passageiro', () => {
    expect(
      mapLogFaltaError({
        code: LOG_FALTA_SQLSTATE_PRAZO_PASSAGEIRO,
        message: 'outro texto cru',
      }),
    ).toBe(LOG_FALTA_MSG_PRAZO_PASSAGEIRO);
  });

  it('não devolve a copy de prazo para outros erros de log_falta', () => {
    const outros = [
      { code: 'BCF01', message: 'A data da falta já passou.' },
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
      expect(getFriendlyErrorMessage(err)).not.toBe(LOG_FALTA_MSG_PRAZO_PASSAGEIRO);
    }
  });
});
