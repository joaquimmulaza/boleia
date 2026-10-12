import { describe, it, expect } from 'vitest';
import {
  resolveJustaCausaConfirmVariant,
  isJustaCausaConfirmSubmitDisabled,
  copyJustaCausaTerminateIntro,
  copyJustaCausaTerminateModoMessage,
  copyJustaCausaTerminateConfirmText,
  copyJustaCausaTerminateTitle,
} from './justaCausaTerminateConfirmCopy';

describe('justa causa — confirmação terminate (v1.10 / P0 1:N)', () => {
  it('resolve variant — motorista encerra acordo inteiro', () => {
    expect(
      resolveJustaCausaConfirmVariant({
        tipoPerfil: 'Motorista',
        lugaresVivosCount: 3,
      }),
    ).toBe('motorista');
  });

  it('resolve variant — passageiro com outros vivos (parcial)', () => {
    expect(
      resolveJustaCausaConfirmVariant({
        tipoPerfil: 'Passageiro',
        lugaresVivosCount: 2,
      }),
    ).toBe('passageiro_parcial');
  });

  it('resolve variant — passageiro último lugar (B2)', () => {
    expect(
      resolveJustaCausaConfirmVariant({
        tipoPerfil: 'Passageiro',
        lugaresVivosCount: 1,
      }),
    ).toBe('passageiro_ultimo');
  });

  it('contagem pendente — não resolve parcial nem activa submit', () => {
    const variant = resolveJustaCausaConfirmVariant({
      tipoPerfil: 'Passageiro',
      lugaresVivosLoading: true,
    });
    expect(variant).toBe('passageiro_contagem_pendente');
    expect(isJustaCausaConfirmSubmitDisabled(variant)).toBe(true);
    expect(
      copyJustaCausaTerminateIntro({
        variant,
        counterparty: 'o motorista',
        odSuffix: '',
      }),
    ).not.toMatch(/terminar o teu lugar/i);
  });

  it('contagem falhou — mensagem de erro e submit desactivado', () => {
    const variant = resolveJustaCausaConfirmVariant({
      tipoPerfil: 'Passageiro',
      lugaresVivosLoading: false,
      lugaresVivosErro: true,
      lugaresVivosCount: null,
    });
    expect(variant).toBe('passageiro_contagem_erro');
    expect(isJustaCausaConfirmSubmitDisabled(variant)).toBe(true);
    expect(
      copyJustaCausaTerminateIntro({
        variant,
        counterparty: 'o motorista',
        odSuffix: '',
      }),
    ).toMatch(/Não foi possível confirmar quantos passageiros/i);
    expect(
      copyJustaCausaTerminateIntro({
        variant,
        counterparty: 'o motorista',
        odSuffix: '',
      }),
    ).not.toMatch(/terminar o teu lugar/i);
  });

  it('passageiro parcial — intro não fala em encerrar o acordo', () => {
    const intro = copyJustaCausaTerminateIntro({
      variant: 'passageiro_parcial',
      counterparty: 'o motorista',
      odSuffix: ' (Talatona → Mutual)',
    });
    expect(intro).toMatch(/terminar o teu lugar/i);
    expect(intro).not.toMatch(/encerrar o acordo/i);
  });

  it('passageiro parcial — modo e CTA não encerram o acordo inteiro', () => {
    const modo = copyJustaCausaTerminateModoMessage({ variant: 'passageiro_parcial' });
    expect(modo).toMatch(/outros passageiros continuam no acordo/i);
    expect(modo).toMatch(/proporcionalmente/i);
    expect(modo).not.toMatch(/O acordo termina de imediato/i);

    expect(copyJustaCausaTerminateConfirmText({ variant: 'passageiro_parcial' })).toBe(
      'Terminar o meu lugar',
    );
  });

  it('passageiro último — alinhado ao fecho do acordo (B2)', () => {
    const intro = copyJustaCausaTerminateIntro({
      variant: 'passageiro_ultimo',
      counterparty: 'o motorista',
      odSuffix: '',
    });
    expect(intro).toMatch(/encerrar o acordo/i);

    const modo = copyJustaCausaTerminateModoMessage({ variant: 'passageiro_ultimo' });
    expect(modo).toMatch(/último passageiro/i);
    expect(modo).toMatch(/proporcionalmente/i);

    expect(copyJustaCausaTerminateConfirmText({ variant: 'passageiro_ultimo' })).toBe(
      'Encerrar acordo',
    );
  });

  it('motorista — copy de encerramento total', () => {
    const intro = copyJustaCausaTerminateIntro({
      variant: 'motorista',
      counterparty: 'os passageiros',
      odSuffix: '',
    });
    expect(intro).toMatch(/encerrar o acordo/i);

    const modo = copyJustaCausaTerminateModoMessage({ variant: 'motorista' });
    expect(modo).toMatch(/O acordo termina de imediato/i);
    expect(modo).toMatch(/proporcionalmente/i);

    expect(copyJustaCausaTerminateConfirmText({ variant: 'motorista' })).toBe('Encerrar acordo');
    expect(copyJustaCausaTerminateTitle({ variant: 'motorista' })).toBe('Confirmar justa causa?');
  });
});
