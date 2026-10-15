import { isLugarVivoPassageiro } from './estadoPassageiro.js';

/**
 * Gate RPC `get_acordo_contactos` — só acordo/lugar vivo (activo ou reservado).
 *
 * @param {{
 *   acordoEstado?: string | null,
 *   tipoPerfil?: string | null,
 *   minhaLinhaEstado?: string | null,
 * }} ctx
 * @returns {boolean}
 */
export function deveChamarGetAcordoContactos(ctx) {
  const perfil = String(ctx.tipoPerfil || '');
  if (perfil === 'Passageiro') {
    return isLugarVivoPassageiro(ctx.minhaLinhaEstado);
  }
  const e = String(ctx.acordoEstado || '').toLowerCase();
  return e === 'activo' || e === 'cancelamento_pendente';
}

/**
 * Payload mínimo quando a RPC falha (400 / P0001) — evita erro cru na UI.
 * @returns {{ bloqueado: true, motivo: string, passageiros: [], motorista: null }}
 */
export function contactosBloqueadosFallback() {
  return {
    bloqueado: true,
    motivo: 'Disponíveis após pagamento em custódia.',
    passageiros: [],
    motorista: null,
  };
}
