import { describe, it, expect } from 'vitest';
import { copyToastJustaCausaPassageiro } from './passageiroJustaCausaToast.js';
import {
  TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO,
  TOAST_JC_PASSAGEIRO_LUGAR_TERMINADO,
} from '../constants/acordoFollowup278Copy.js';

describe('copyToastJustaCausaPassageiro — P0 v1.12', () => {
  it('acordo continua — toast parcial', () => {
    expect(
      copyToastJustaCausaPassageiro({
        tipoPerfil: 'Passageiro',
        modo: 'justa_causa',
        acordoEstadoApos: 'activo',
        lugaresVivosAntes: 2,
      }),
    ).toBe(TOAST_JC_PASSAGEIRO_LUGAR_TERMINADO);
  });

  it('último passageiro — acordo encerrado', () => {
    expect(
      copyToastJustaCausaPassageiro({
        tipoPerfil: 'Passageiro',
        modo: 'justa_causa',
        acordoEstadoApos: 'cancelado',
        lugaresVivosAntes: 1,
      }),
    ).toBe(TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO);
    expect(TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO).toBe(
      'Terminaste o teu lugar por justa causa. O acordo foi encerrado.',
    );
  });
});
