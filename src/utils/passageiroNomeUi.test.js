import { describe, it, expect } from 'vitest';
import {
  nomePassageiroUi,
  iniciaisPassageiroUi,
} from './passageiroNomeUi.js';

describe('passageiroNomeUi — #269 QA distinguishable', () => {
  it('motorista: ignora prefixo QA e usa o token seguinte', () => {
    expect(
      nomePassageiroUi(
        { perfis: { nome_completo: 'QA Passageiro 3' } },
        { motorista: true },
      ),
    ).toBe('Passageiro');
    expect(
      nomePassageiroUi(
        { perfis: { nome_completo: 'QA Passenger Three' } },
        { motorista: true },
      ),
    ).toBe('Passenger');
    expect(nomePassageiroUi(
      { perfis: { nome_completo: 'QA Passageiro 3' } },
      { motorista: true },
    )).not.toBe(
      nomePassageiroUi(
        { perfis: { nome_completo: 'QA Passenger Three' } },
        { motorista: true },
      ),
    );
  });

  it('iniciais alinhadas ao nome motorista (não «QA»)', () => {
    const nome = nomePassageiroUi(
      { perfis: { nome_completo: 'QA Passageiro 3' } },
      { motorista: true },
    );
    expect(iniciaisPassageiroUi(nome)).toBe('PA');
  });

  it('passageiro mantém nome completo', () => {
    expect(
      nomePassageiroUi({ perfis: { nome_completo: 'QA Passageiro 3' } }),
    ).toBe('QA Passageiro 3');
  });
});
