import { describe, it, expect } from 'vitest';
import {
  mostrarProximoPassoComprovativoPassageiro,
  mostrarProximoPassoComprovativoPassageiroLegado,
} from './contactosProximoPassoPagamento.js';

describe('contactosProximoPassoPagamento — hint comprovativo (QA prod)', () => {
  it('reservado + pendente_pagamento: mostra hint', () => {
    expect(
      mostrarProximoPassoComprovativoPassageiro(true, 'pendente_pagamento'),
    ).toBe(true);
  });

  it('reservado + comprovativo_enviado: não mostra hint', () => {
    expect(
      mostrarProximoPassoComprovativoPassageiro(true, 'comprovativo_enviado'),
    ).toBe(false);
  });

  it('regressão: lógica antiga (só reservado) mostrava hint indevidamente com comprovativo enviado', () => {
    expect(mostrarProximoPassoComprovativoPassageiroLegado(true)).toBe(true);
    expect(
      mostrarProximoPassoComprovativoPassageiro(true, 'comprovativo_enviado'),
    ).toBe(false);
  });

  it('oculta hint para custódia, liquidado, reembolsado e anulado', () => {
    for (const estado of ['em_custodia', 'liquidado', 'reembolsado', 'anulado']) {
      expect(mostrarProximoPassoComprovativoPassageiro(true, estado)).toBe(false);
    }
  });

  it('não reservado: nunca mostra hint', () => {
    expect(
      mostrarProximoPassoComprovativoPassageiro(false, 'pendente_pagamento'),
    ).toBe(false);
  });
});
