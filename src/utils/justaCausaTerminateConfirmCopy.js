/**
 * Copy da folha de confirmação — justa causa imediata (`TerminateConfirmSheet`).
 * Passageiro 1:N: parcial termina só o lugar; último (B2) encerra o acordo; motorista encerra tudo.
 *
 * TODO(Copywriter): rever strings «passageiro_parcial» com copy oficial v1.10 se existir doc separado.
 */

/** @typedef {'motorista' | 'passageiro_parcial' | 'passageiro_ultimo' | 'passageiro_contagem_pendente' | 'passageiro_contagem_erro'} JustaCausaConfirmVariant */

/** TODO(Copywriter): mensagem definitiva se falhar count_lugares_vivos. */
const COPY_ERRO_CONTAGEM_LUGARES_VIVOS =
  'Não foi possível confirmar quantos passageiros ainda estão no acordo. Fecha e tenta outra vez.';

/**
 * @param {{
 *   tipoPerfil: string | null | undefined,
 *   lugaresVivosCount: number | null | undefined,
 *   lugaresVivosLoading?: boolean,
 *   lugaresVivosErro?: boolean,
 * }} ctx
 * @returns {JustaCausaConfirmVariant}
 */
export function resolveJustaCausaConfirmVariant(ctx) {
  if (String(ctx.tipoPerfil || '') === 'Motorista') {
    return 'motorista';
  }
  if (ctx.lugaresVivosLoading) {
    return 'passageiro_contagem_pendente';
  }
  if (ctx.lugaresVivosErro || ctx.lugaresVivosCount == null) {
    return 'passageiro_contagem_erro';
  }
  if (ctx.lugaresVivosCount <= 1) {
    return 'passageiro_ultimo';
  }
  return 'passageiro_parcial';
}

/**
 * @param {JustaCausaConfirmVariant} variant
 * @returns {boolean}
 */
export function isJustaCausaConfirmSubmitDisabled(variant) {
  return variant === 'passageiro_contagem_pendente' || variant === 'passageiro_contagem_erro';
}

/**
 * @param {{ variant: JustaCausaConfirmVariant, counterparty: string, odSuffix: string }} params
 * @returns {string}
 */
export function copyJustaCausaTerminateIntro({ variant, counterparty, odSuffix }) {
  if (variant === 'passageiro_contagem_pendente') {
    return 'A confirmar quantos passageiros ainda estão no acordo…';
  }
  if (variant === 'passageiro_contagem_erro') {
    return COPY_ERRO_CONTAGEM_LUGARES_VIVOS;
  }
  const suffix = odSuffix || '';
  if (variant === 'passageiro_parcial') {
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
  if (variant === 'passageiro_contagem_pendente' || variant === 'passageiro_contagem_erro') {
    return '';
  }
  if (variant === 'passageiro_parcial') {
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
  if (variant === 'passageiro_parcial') {
    return 'Terminar o meu lugar';
  }
  if (variant === 'passageiro_contagem_pendente' || variant === 'passageiro_contagem_erro') {
    return 'Confirmar';
  }
  return 'Encerrar acordo';
}

/**
 * @param {{ variant: JustaCausaConfirmVariant }} params
 * @returns {string}
 */
export function copyJustaCausaTerminateTitle({ variant }) {
  if (variant === 'passageiro_parcial') {
    return 'Confirmar justa causa do teu lugar?';
  }
  return 'Confirmar justa causa?';
}
