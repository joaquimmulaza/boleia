import { formatKwanza } from './formatKwanza';
import { isActivoPassageiro } from './acordoPassageiroStatus';
import { isLugarVivoPassageiro } from './estadoPassageiro.js';
import { PAYMENT_STATES } from './paymentStatus';
import { valorEmDividaParaExibir } from './pagamentoObrigacaoCopy';

/** Copy modal quando o servidor confirma um único lugar vivo. */
export const COPY_CONFIRMACAO_ULTIMO_PASSAGEIRO =
  'És o último passageiro. Ao saíres, o acordo é encerrado.';

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
 * Linha financeira do modal (sem prefixo de saída individual).
 *
 * @param {{
 *   lugarEstado?: string | null,
 *   pagamento?: { estado?: string } | null,
 *   pagamentoLoading?: boolean,
 * }} ctx
 * @returns {string}
 */
function copyLinhaFinanceiraSaidaPassageiro(ctx) {
  if (isLugarActivadoParaQuota(ctx.lugarEstado)) {
    return 'A tua quota deste mês não é reembolsada.';
  }
  if (ctx.pagamentoLoading) {
    return 'A confirmar o estado do pagamento…';
  }
  if (pagamentoPendenteOuComprovativo(ctx.pagamento?.estado)) {
    return 'O teu pagamento pendente será cancelado. Não tens nada a pagar.';
  }
  return 'Não tens nada a pagar neste acordo.';
}

/**
 * Mensagem do modal «Sair só tu?» (passageiro).
 *
 * @param {{
 *   lugarEstado?: string | null,
 *   pagamento?: { estado?: string } | null,
 *   pagamentoLoading?: boolean,
 *   lugaresVivosCount?: number | null,
 *   lugaresVivosLoading?: boolean,
 * }} ctx
 * @returns {string}
 */
export function copyConfirmacaoSaidaPassageiro(ctx) {
  const prefixoIndividual =
    'Saída individual: o acordo mantém-se activo para os restantes. ';
  const copyBase = prefixoIndividual + copyLinhaFinanceiraSaidaPassageiro(ctx);

  if (
    !ctx.lugaresVivosLoading
    && ctx.lugaresVivosCount === 1
    && isLugarVivoPassageiro(ctx.lugarEstado)
  ) {
    return `${copyBase} ${COPY_CONFIRMACAO_ULTIMO_PASSAGEIRO}`;
  }

  return copyBase;
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
