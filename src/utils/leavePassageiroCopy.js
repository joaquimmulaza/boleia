import { formatKwanza } from './formatKwanza';
import { isActivoPassageiro } from './acordoPassageiroStatus';
import { PAYMENT_STATES } from './paymentStatus';
import { valorEmDividaParaExibir } from './pagamentoObrigacaoCopy';

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
 * }} ctx
 * @returns {string}
 */
export function copyConfirmacaoSaidaPassageiro(ctx) {
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
      + 'O teu pagamento pendente será cancelado — não tens nada a pagar.'
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
