import { isLugarVivoPassageiro } from './estadoPassageiro.js';

/**
 * @param {string | null | undefined} estadoAcordo
 * @returns {boolean}
 */
export function isAcordoEstadoListaActivo(estadoAcordo) {
  const e = String(estadoAcordo || '').toLowerCase();
  return e === 'activo' || e === 'cancelamento_pendente';
}

/**
 * Agrupa acordos na lista `/acordos`.
 * Passageiro: pelo estado do **próprio** lugar; motorista: pelo estado do acordo.
 *
 * @param {object[]} acordos
 * @param {{ tipoPerfil?: string | null, viewerUserId?: string | null }} ctx
 * @returns {{ activos: object[], encerrados: object[] }}
 */
export function partitionAcordosLista(acordos, ctx) {
  const list = Array.isArray(acordos) ? acordos : [];
  const activos = [];
  const encerrados = [];
  const isPassageiro = ctx.tipoPerfil === 'Passageiro';

  for (const acordo of list) {
    if (isPassageiro && ctx.viewerUserId) {
      const linha = (acordo.acordos_passageiros || []).find(
        (p) => String(p.passenger_id) === String(ctx.viewerUserId),
      );
      if (linha && isLugarVivoPassageiro(linha.estado)) {
        activos.push(acordo);
      } else {
        encerrados.push(acordo);
      }
    } else if (isAcordoEstadoListaActivo(acordo.estado)) {
      activos.push(acordo);
    } else {
      encerrados.push(acordo);
    }
  }

  return { activos, encerrados };
}
