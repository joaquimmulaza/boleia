import {
  TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO,
  TOAST_JC_PASSAGEIRO_LUGAR_TERMINADO,
} from '../constants/acordoFollowup278Copy.js';
import { isAcordoEstadoListaActivo } from './acordoListGrouping.js';

/**
 * Toast pós-terminate justa causa (passageiro 1:N).
 *
 * @param {{
 *   tipoPerfil?: string | null,
 *   modo?: string | null,
 *   acordoEstadoApos?: string | null,
 *   lugaresVivosAntes?: number | null,
 * }} ctx
 * @returns {string | null}
 */
export function copyToastJustaCausaPassageiro(ctx) {
  if (String(ctx.tipoPerfil || '') !== 'Passageiro') return null;
  if (String(ctx.modo || '').toLowerCase() !== 'justa_causa') return null;

  const aindaActivo = isAcordoEstadoListaActivo(ctx.acordoEstadoApos);
  if (aindaActivo) {
    return TOAST_JC_PASSAGEIRO_LUGAR_TERMINADO;
  }
  if (ctx.lugaresVivosAntes != null && ctx.lugaresVivosAntes <= 1) {
    return TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO;
  }
  const e = String(ctx.acordoEstadoApos || '').toLowerCase();
  if (e === 'cancelado' || e === 'cancelado_justificado' || e === 'expirado') {
    return TOAST_JC_PASSAGEIRO_ACORDO_ENCERRADO;
  }
  return TOAST_JC_PASSAGEIRO_LUGAR_TERMINADO;
}
