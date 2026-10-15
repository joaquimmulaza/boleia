import {
  CHIP_LUGAR_JA_NAO_ESTA,
  CHIP_LUGAR_RESERVA_EXPIRADA,
  CHIP_LUGAR_RETIRADO,
  CHIP_LUGAR_SAiu,
  CHIP_LUGAR_SAiu_JUSTA_CAUSA,
} from '../constants/acordoFollowup278Copy.js';
import { normalizeEstadoPassageiroKey } from './estadoPassageiro.js';
import {
  isAnulacaoMotivoLugarTerminadoAntesActivacao,
  isAnulacaoMotivoSaidaVoluntaria,
  isAnulacaoReservaExpiradaPorPagamento,
} from './pagamentoAnulacaoMotivo.js';

/** Classes neutras (shadcn Badge outline-style) — sem cor de erro. */
export const CHIP_LUGAR_FIM_NEUTRAL_CLASS =
  'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80';

/**
 * @typedef {'voluntario' | 'justa_causa' | 'motorista_retirou' | 'reserva_expirada' | 'desconhecido'} MotivoFimLugar
 */

/**
 * @param {{
 *   estado?: string | null,
 *   lugar_rescisao_modo?: string | null,
 *   lugar_saida_iniciador?: string | null,
 * }} linha
 * @param {{ anulacao_motivo?: string | null, estado?: string | null } | null | undefined} [pagamento]
 * @returns {MotivoFimLugar}
 */
export function resolveMotivoFimLugar(linha, pagamento) {
  const estado = normalizeEstadoPassageiroKey(linha?.estado);
  if (String(linha?.lugar_rescisao_modo || '').toLowerCase() === 'justa_causa') {
    return 'justa_causa';
  }
  if (estado === 'expirado') {
    if (isAnulacaoMotivoSaidaVoluntaria(pagamento)) {
      return 'voluntario';
    }
    if (isAnulacaoReservaExpiradaPorPagamento(pagamento)) {
      return 'reserva_expirada';
    }
    if (isAnulacaoMotivoLugarTerminadoAntesActivacao(pagamento)) {
      return 'reserva_expirada';
    }
    return 'reserva_expirada';
  }
  if (estado === 'saiu') {
    if (String(linha?.lugar_saida_iniciador || '').toLowerCase() === 'motorista') {
      return 'motorista_retirou';
    }
    return 'voluntario';
  }
  if (estado === 'activo' || estado === 'reservado') {
    return 'desconhecido';
  }
  return 'desconhecido';
}

/**
 * Label única para chips de fim de lugar (lista motorista + cartão passageiro).
 *
 * @param {{
 *   estado?: string | null,
 *   lugar_rescisao_modo?: string | null,
 *   lugar_saida_iniciador?: string | null,
 * }} linha
 * @param {{ anulacao_motivo?: string | null, estado?: string | null } | null | undefined} [pagamento]
 * @returns {string | null} null se lugar ainda vivo — não mostrar chip de fim
 */
export function labelChipFimLugar(linha, pagamento) {
  const estado = normalizeEstadoPassageiroKey(linha?.estado);
  if (estado === 'activo' || estado === 'reservado') {
    if (estado === 'reservado') return 'Reservado';
    if (estado === 'activo') return 'Confirmado';
    return null;
  }
  const motivo = resolveMotivoFimLugar(linha, pagamento);
  switch (motivo) {
    case 'justa_causa':
      return CHIP_LUGAR_SAiu_JUSTA_CAUSA;
    case 'motorista_retirou':
      return CHIP_LUGAR_RETIRADO;
    case 'reserva_expirada':
      return CHIP_LUGAR_RESERVA_EXPIRADA;
    case 'voluntario':
      return CHIP_LUGAR_SAiu;
    default:
      return CHIP_LUGAR_JA_NAO_ESTA;
  }
}

/**
 * @param {string | null | undefined} label
 * @returns {string}
 */
export function chipClassFimLugar(label) {
  if (!label || label === 'Confirmado') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';
  }
  if (label === 'Reservado') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
  }
  return CHIP_LUGAR_FIM_NEUTRAL_CLASS;
}

/**
 * @param {string | null | undefined} label
 * @returns {boolean}
 */
export function mostrarChipFimLugar(label) {
  if (!label) return false;
  return !['Confirmado'].includes(label);
}
