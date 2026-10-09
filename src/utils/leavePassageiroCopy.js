import { formatKwanza } from './formatKwanza';
import { isActivoPassageiro, isReservadoPassageiro } from './acordoPassageiroStatus';
import { PAYMENT_STATES } from './paymentStatus';
import { valorEmDividaParaExibir } from './pagamentoObrigacaoCopy';

/**
 * Lugar vivo = reservado ou activo (contagem para último passageiro).
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function isLugarVivoPassageiro(estado) {
  return isActivoPassageiro(estado) || isReservadoPassageiro(estado);
}

/**
 * @param {Array<{ estado?: string | null }> | null | undefined} linhas
 * @returns {number}
 */
export function countLugaresVivosAcordo(linhas) {
  return (linhas || []).filter((p) => isLugarVivoPassageiro(p.estado)).length;
}

/**
 * @param {Array<{ passenger_id?: string, estado?: string | null }> | null | undefined} linhas
 * @param {string | null | undefined} passengerId
 * @returns {boolean}
 */
export function isUltimoPassageiroVivoNoAcordo(linhas, passengerId) {
  if (!passengerId || countLugaresVivosAcordo(linhas) !== 1) {
    return false;
  }
  const mine = (linhas || []).find((p) => p.passenger_id === passengerId);
  return Boolean(mine && isLugarVivoPassageiro(mine.estado));
}

/**
 * @param {string | null | undefined} lugarEstado
 * @returns {boolean}
 */
export function isLugarActivadoParaQuota(lugarEstado) {
  return isActivoPassageiro(lugarEstado);
}

/**
 * @param {string | null | undefined} pagamentoEstado
 * @returns {boolean}
 */
function pagamentoPendenteOuComprovativo(pagamentoEstado) {
  const e = String(pagamentoEstado || '').toLowerCase();
  return e === PAYMENT_STATES.PENDENTE || e === PAYMENT_STATES.COMPROVATIVO;
}

/**
 * Mensagem do modal «Sair só tu?» (passageiro).
 *
 * @param {{
 *   lugarEstado?: string | null,
 *   pagamento?: { estado?: string } | null,
 *   pagamentoLoading?: boolean,
 *   ultimoPassageiroVivo?: boolean,
 * }} ctx
 * @returns {string}
 */
export function copyConfirmacaoSaidaPassageiro(ctx) {
  if (ctx.ultimoPassageiroVivo) {
    return 'És o último passageiro. Ao saíres, o acordo é encerrado.';
  }
  if (isLugarActivadoParaQuota(ctx.lugarEstado)) {
    return (
      'Saída individual: o acordo mantém-se activo para os restantes. '
      + 'A tua quota deste mês não é reembolsada.'
    );
  }
  if (ctx.pagamentoLoading) {
    return (
      'Saída individual: o acordo mantém-se activo para os restantes. '
      + 'A confirmar o estado do pagamento…'
    );
  }
  if (pagamentoPendenteOuComprovativo(ctx.pagamento?.estado)) {
    return (
      'Saída individual: o acordo mantém-se activo para os restantes. '
      + 'O teu pagamento pendente será cancelado. Não tens nada a pagar.'
    );
  }
  return (
    'Saída individual: o acordo mantém-se activo para os restantes. '
    + 'Não tens nada a pagar neste acordo.'
  );
}

/**
 * Toast após saída individual bem-sucedida.
 *
 * @param {{
 *   lugarEstado?: string | null,
 *   pagamento?: { estado?: string } | null,
 *   obrigacao?: import('./pagamentoObrigacaoCopy.js').ObrigacaoSnapshot | null,
 * }} ctx
 * @returns {string}
 */
export function copyToastSaidaPassageiro(ctx) {
  if (isLugarActivadoParaQuota(ctx.lugarEstado)) {
    const valorDivida = valorEmDividaParaExibir(ctx.obrigacao, ctx.pagamento);
    if (valorDivida > 0) {
      return (
        `Saíste do acordo. A quota proporcional deste mês mantém-se (${formatKwanza(valorDivida)} Kz).`
      );
    }
    return 'Saíste do acordo. A quota do mês mantém-se.';
  }
  if (pagamentoPendenteOuComprovativo(ctx.pagamento?.estado)) {
    return 'Saíste do acordo. O pagamento pendente foi cancelado.';
  }
  return 'Saíste do acordo. Não tens nada a pagar.';
}
