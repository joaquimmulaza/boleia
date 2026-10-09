/**
 * Literais de `pagamentos_acordo.anulacao_motivo` (migração P0 20261009180000).
 * Manter byte-a-byte com o SQL — sem matching por substring na UI.
 */
export const ANULACAO_MOTIVO = Object.freeze({
  PRAZO_RESERVA_EXPIRADO: 'Prazo de reserva expirado',
  SAISTE_ANTES_ACTIVACAO: 'Saíste antes da activação do lugar',
  ACORDO_TERMINADO_ANTES_ACTIVACAO: 'Acordo terminado antes da activação',
  RESERVA_TERMINADA_SEM_ACTIVACAO: 'Reserva terminada sem activação',
});

/** Motivos que mapeiam para UI S1 (expiração / TTL reserva). */
export const ANULACAO_MOTIVOS_EXPIRACAO_RESERVA = Object.freeze([
  ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO,
  ANULACAO_MOTIVO.RESERVA_TERMINADA_SEM_ACTIVACAO,
]);

/** Todos os motivos canónicos referenciados na migração P0. */
export const ANULACAO_MOTIVOS_TODOS = Object.freeze(Object.values(ANULACAO_MOTIVO));
