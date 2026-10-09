import { formatKwanza } from './formatKwanza';
import { formatMesAdendaPt } from './adendaStatus';
import {
  normalizeObrigacaoSnapshot,
  valorEmDividaParaExibir,
  isPagamentoEmExcessoAnalise,
} from './pagamentoObrigacaoCopy';
import { PAYMENT_STATES } from './paymentStatus';
import { isAnulacaoReservaExpiradaPorPagamento } from './pagamentoAnulacaoMotivo';
import { estadoPassageiroParaChip } from './estadoPassageiro.js';

/** @typedef {'S1' | 'S2' | 'S3' | 'S6a' | null} PassageiroPagamentoUiVariant */

/**
 * @param {ObrigacaoSnapshot | null | undefined} obrigacao
 * @returns {number}
 */
function excessoKzFromObrigacao(obrigacao) {
  const norm = normalizeObrigacaoSnapshot(obrigacao);
  if (!norm) return 0;
  const pago = Number(norm.pago) || 0;
  const devido = Number(norm.proporcional) || 0;
  return Math.max(0, pago - devido);
}

/**
 * Resolve variante P0 passageiro (Figma S1/S2/S3/S6a) para título do sheet e cartão de estado.
 *
 * @param {{
 *   minhaLinha?: { estado?: string } | null,
 *   pagamento?: { estado?: string, requer_resolucao_admin?: boolean, anulacao_motivo?: string | null, valor_quota_original_kz?: number } | null,
 *   obrigacao?: import('./pagamentoObrigacaoCopy.js').ObrigacaoSnapshot | null,
 * }} ctx
 * @returns {{
 *   variant: PassageiroPagamentoUiVariant,
 *   sheetTitle: string,
 *   mostrarCartaoEstado: boolean,
 *   ocultarPainelPagamento: boolean,
 *   ocultarBannerExpiradoLegado: boolean,
 * }}
 */
export function resolveAcordoPagamentoUiPassageiro(ctx) {
  const lugar = estadoPassageiroParaChip(ctx.minhaLinha?.estado, ctx.pagamento);
  const pagamento = ctx.pagamento;
  const pgEst = String(pagamento?.estado || '').toLowerCase();
  const obrigacao = normalizeObrigacaoSnapshot(ctx.obrigacao);
  const valorDivida = valorEmDividaParaExibir(obrigacao, pagamento);
  const emExcesso = isPagamentoEmExcessoAnalise(pagamento);

  if (emExcesso) {
    return {
      variant: 'S6a',
      sheetTitle: 'Diferença em análise',
      mostrarCartaoEstado: true,
      ocultarPainelPagamento: true,
      ocultarBannerExpiradoLegado: false,
    };
  }

  if (pgEst === PAYMENT_STATES.ANULADO && valorDivida <= 0) {
    const expiradaPorPagamento =
      lugar === 'expirado' && isAnulacaoReservaExpiradaPorPagamento(pagamento);
    if (expiradaPorPagamento) {
      return {
        variant: 'S1',
        sheetTitle: 'A tua reserva expirou',
        mostrarCartaoEstado: true,
        ocultarPainelPagamento: true,
        ocultarBannerExpiradoLegado: true,
      };
    }
    return {
      variant: 'S3',
      sheetTitle: 'Não tens nada a pagar',
      mostrarCartaoEstado: true,
      ocultarPainelPagamento: true,
      ocultarBannerExpiradoLegado: true,
    };
  }

  if (lugar === 'expirado' && valorDivida <= 0) {
    const ttlReserva = isAnulacaoReservaExpiradaPorPagamento(pagamento);
    if (!pagamento || ttlReserva) {
      return {
        variant: 'S1',
        sheetTitle: 'A tua reserva expirou',
        mostrarCartaoEstado: true,
        ocultarPainelPagamento: true,
        ocultarBannerExpiradoLegado: true,
      };
    }
    return {
      variant: 'S3',
      sheetTitle: 'Não tens nada a pagar',
      mostrarCartaoEstado: true,
      ocultarPainelPagamento: true,
      ocultarBannerExpiradoLegado: true,
    };
  }

  if ((lugar === 'saiu' || lugar === 'terminado') && valorDivida <= 0 && pgEst === PAYMENT_STATES.ANULADO) {
    return {
      variant: 'S3',
      sheetTitle: 'Não tens nada a pagar',
      mostrarCartaoEstado: true,
      ocultarPainelPagamento: true,
      ocultarBannerExpiradoLegado: true,
    };
  }

  if (lugar === 'saiu' && valorDivida > 0
    && (pgEst === PAYMENT_STATES.PENDENTE || pgEst === PAYMENT_STATES.COMPROVATIVO)) {
    return {
      variant: 'S2',
      sheetTitle: 'Saíste do acordo',
      mostrarCartaoEstado: true,
      ocultarPainelPagamento: false,
      ocultarBannerExpiradoLegado: false,
    };
  }

  return {
    variant: null,
    sheetTitle: 'Detalhe do acordo',
    mostrarCartaoEstado: false,
    ocultarPainelPagamento: false,
    ocultarBannerExpiradoLegado: false,
  };
}

/**
 * Copy do cartão de estado (passageiro).
 *
 * @param {PassageiroPagamentoUiVariant} variant
 * @param {{
 *   pagamento?: { anulacao_motivo?: string | null, valor_quota_original_kz?: number } | null,
 *   obrigacao?: import('./pagamentoObrigacaoCopy.js').ObrigacaoSnapshot | null,
 * }} ctx
 * @returns {{ titulo?: string, corpo: string, secundaria: string | null, mostrarUploadNoCartao: boolean }}
 */
export function copyCartaoEstadoPagamentoPassageiro(variant, ctx) {
  const obrigacao = normalizeObrigacaoSnapshot(ctx.obrigacao);
  const pagamento = ctx.pagamento;
  const valorDivida = valorEmDividaParaExibir(obrigacao, pagamento);

  if (variant === 'S1') {
    return {
      corpo:
        'O pagamento não foi confirmado a tempo. O lugar não chegou a ficar activo e não tens nada a pagar.',
      secundaria: null,
      mostrarUploadNoCartao: false,
    };
  }

  if (variant === 'S2') {
    const secundaria = linhaSecundariaCartaoS2(obrigacao);
    return {
      corpo: `Ainda tens de pagar ${formatKwanza(valorDivida)} Kz.`,
      secundaria,
      mostrarUploadNoCartao: true,
    };
  }

  if (variant === 'S3') {
    const valorCancelado = Number(
      pagamento?.valor_quota_original_kz ?? obrigacao?.quota ?? valorDivida,
    ) || 0;
    const motivo = String(pagamento?.anulacao_motivo || '').trim();
    let secundaria = null;
    if (motivo) {
      secundaria = `Motivo: ${motivo}.`;
    }
    return {
      corpo: `O pagamento de ${formatKwanza(valorCancelado)} Kz deste acordo foi cancelado.`,
      secundaria,
      mostrarUploadNoCartao: false,
    };
  }

  if (variant === 'S6a') {
    const pago = Number(obrigacao?.pago) || 0;
    const devido = Number(obrigacao?.proporcional) || 0;
    const excesso = excessoKzFromObrigacao(obrigacao);
    return {
      corpo:
        `Pagaste ${formatKwanza(pago)} Kz e o valor até ao fim do acordo é ${formatKwanza(devido)} Kz. `
        + `A diferença de ${formatKwanza(excesso)} Kz está em análise.`,
      secundaria: null,
      mostrarUploadNoCartao: false,
    };
  }

  return { corpo: '', secundaria: null, mostrarUploadNoCartao: false };
}

/**
 * Secundária S2 — parcial se já pagou parte; senão «Referente a…».
 * @param {import('./pagamentoObrigacaoCopy.js').ObrigacaoSnapshot | null | undefined} obrigacao
 * @returns {string | null}
 */
export function linhaSecundariaCartaoS2(obrigacao) {
  const norm = normalizeObrigacaoSnapshot(obrigacao);
  if (!norm) return null;
  const dias = Number(norm.dias);
  const diasMes = Number(norm.dias_mes);
  if (!Number.isFinite(diasMes) || diasMes < 1) return null;
  const mesLabel = norm.mes ? formatMesAdendaPt(String(norm.mes).slice(0, 10)) : 'este mês';
  const diasTxt = Number.isFinite(dias) ? dias : 0;
  const pago = Number(norm.pago) || 0;
  const proporcional = Number(norm.proporcional);
  if (pago > 0 && Number.isFinite(proporcional)) {
    return (
      `${diasTxt} de ${diasMes} dias úteis de ${mesLabel} dão ${formatKwanza(proporcional)} Kz. `
      + `Já pagaste ${formatKwanza(pago)} Kz.`
    );
  }
  return `Referente a ${diasTxt} de ${diasMes} dias úteis de ${mesLabel}.`;
}

/**
 * Linha motorista — comprovativo em validação (S4).
 * @param {string} nome
 * @param {number | null | undefined} valorComprovativo
 * @returns {string | null}
 */
export function linhaMotoristaComprovativoValidacao(nome, valorComprovativo) {
  const valor = Number(valorComprovativo);
  if (!nome || !Number.isFinite(valor) || valor <= 0) return null;
  return `${nome} · comprovativo de ${formatKwanza(valor)} Kz em validação`;
}

/**
 * Linha motorista — excesso em análise (S6b).
 * @param {string} nome
 * @param {number | null | undefined} excessoKz
 * @returns {string | null}
 */
export function linhaMotoristaDiferencaExcesso(nome, excessoKz) {
  const excesso = Number(excessoKz);
  if (!nome || !Number.isFinite(excesso) || excesso <= 0) return null;
  return `${nome} · diferença de ${formatKwanza(excesso)} Kz`;
}

/**
 * Linha principal motorista S4.
 * @param {string} nome
 * @param {number} valorEmDivida
 * @returns {string}
 */
export function linhaMotoristaValorEmDivida(nome, valorEmDivida) {
  const valor = Number(valorEmDivida) || 0;
  return `${nome} · ${formatKwanza(valor)} Kz`;
}

/**
 * O valor devido veio de cálculo proporcional (saída/rescisão), não quota mensal integral.
 * @param {import('./pagamentoObrigacaoCopy.js').ObrigacaoSnapshot | null | undefined} snap
 * @returns {boolean}
 */
export function obrigacaoMostraLinhaDiasUteisMotorista(snap) {
  const norm = normalizeObrigacaoSnapshot(snap);
  if (!norm) return false;
  const quota = Number(norm.quota);
  if (!Number.isFinite(quota) || quota <= 0) return false;
  const proporcional = Number(norm.proporcional);
  const valorEmDivida = Number(norm.valor_em_divida) || 0;
  const pago = Number(norm.pago) || 0;
  const devidoTotal = Number.isFinite(proporcional) ? proporcional : valorEmDivida + pago;
  return devidoTotal < quota;
}

/**
 * Secundária motorista — dias úteis (só quando o devido é proporcional, não quota integral).
 * @param {import('./pagamentoObrigacaoCopy.js').ObrigacaoSnapshot | null | undefined} snap
 * @returns {string | null}
 */
export function linhaSecundariaMotoristaDias(snap) {
  const norm = normalizeObrigacaoSnapshot(snap);
  if (!norm || !obrigacaoMostraLinhaDiasUteisMotorista(norm)) return null;
  const dias = Number(norm.dias);
  const diasMes = Number(norm.dias_mes);
  if (!Number.isFinite(diasMes) || diasMes < 1) return null;
  const mesLabel = norm.mes ? formatMesAdendaPt(String(norm.mes).slice(0, 10)) : 'este mês';
  const diasTxt = Number.isFinite(dias) ? dias : 0;
  return `Referente a ${diasTxt} de ${diasMes} dias úteis de ${mesLabel}.`;
}

/**
 * S5 — confirmação consensual repetida.
 * @param {string | null | undefined} confirmadaEmIso
 * @returns {string | null}
 */
export function linhaJaConfirmadoRescisaoConsensual(confirmadaEmIso) {
  if (!confirmadaEmIso) return null;
  const d = new Date(confirmadaEmIso);
  if (Number.isNaN(d.getTime())) return null;
  const data = d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Luanda',
  });
  return `Já tinhas confirmado a ${data}.`;
}
