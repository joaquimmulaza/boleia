/**
 * Copy da folha de confirmação — justa causa imediata (`TerminateConfirmSheet`).
 * Passageiro 1:N: parcial termina só o lugar; último (B2) encerra o acordo; motorista encerra tudo.
 *
 * TODO(Copywriter): rever strings «passageiro_parcial» com copy oficial v1.10 se existir doc separado.
 */

/** @typedef {'motorista' | 'passageiro_parcial' | 'passageiro_ultimo' | 'passageiro_fallback_parcial'} JustaCausaConfirmVariant */

/**
 * @param {{
 *   tipoPerfil: string | null | undefined,
 *   lugaresVivosCount: number | null | undefined,
 *   lugaresVivosLoading?: boolean,
 * }} ctx
 * @returns {JustaCausaConfirmVariant}
 */
export function resolveJustaCausaConfirmVariant(ctx) {
  if (String(ctx.tipoPerfil || '') === 'Motorista') {
    return 'motorista';
  }
  if (ctx.lugaresVivosLoading || ctx.lugaresVivosCount == null) {
    return 'passageiro_fallback_parcial';
  }
  if (ctx.lugaresVivosCount <= 1) {
    return 'passageiro_ultimo';
  }
  return 'passageiro_parcial';
}

/**
 * @param {{ variant: JustaCausaConfirmVariant, counterparty: string, odSuffix: string }} params
 * @returns {string}
 */
export function copyJustaCausaTerminateIntro({ variant, counterparty, odSuffix }) {
  const suffix = odSuffix || '';
  if (variant === 'passageiro_parcial' || variant === 'passageiro_fallback_parcial') {
    return (
      `Vais terminar o teu lugar no acordo com ${counterparty}${suffix}. `
      + 'Esta acção não se pode desfazer. O valor acordado deixa de aplicar-se ao teu lugar a partir do fecho.'
    );
  }
  return (
    `Vais encerrar o acordo com ${counterparty}${suffix}. `
    + 'Esta acção não se pode desfazer. O valor acordado deixa de aplicar-se a partir do fecho.'
  );
}

/**
 * @param {{ variant: JustaCausaConfirmVariant }} params
 * @returns {string}
 */
export function copyJustaCausaTerminateModoMessage({ variant }) {
  if (variant === 'passageiro_parcial' || variant === 'passageiro_fallback_parcial') {
    return (
      'Se o motivo for válido, terminas só o teu lugar. Os outros passageiros continuam no acordo. '
      + 'A tua quota deste mês ajusta-se proporcionalmente até hoje.'
    );
  }
  if (variant === 'passageiro_ultimo') {
    return (
      'És o último passageiro. O acordo encerra de imediato se o motivo for válido. '
      + 'A tua quota deste mês ajusta-se proporcionalmente até hoje.'
    );
  }
  return (
    'O acordo termina de imediato se o motivo for válido. '
    + 'As quotas deste mês são ajustadas proporcionalmente.'
  );
}

/**
 * @param {{ variant: JustaCausaConfirmVariant }} params
 * @returns {string}
 */
export function copyJustaCausaTerminateConfirmText({ variant }) {
  if (variant === 'passageiro_parcial' || variant === 'passageiro_fallback_parcial') {
    return 'Terminar o meu lugar';
  }
  return 'Encerrar acordo';
}

/**
 * @param {{ variant: JustaCausaConfirmVariant }} params
 * @returns {string}
 */
export function copyJustaCausaTerminateTitle({ variant }) {
  if (variant === 'passageiro_parcial' || variant === 'passageiro_fallback_parcial') {
    return 'Confirmar justa causa do teu lugar?';
  }
  return 'Confirmar justa causa?';
}
