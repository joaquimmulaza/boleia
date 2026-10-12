import { formatCivilDateLuandaPtNoYearFromIso } from './rescisaoDisplay';

/** Tipo em `notificacoes.metadata.type` (RPC `terminate_agreement`, ramo passageiro JC). */
export const JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE = 'justa_causa_passageiro_invocador';

/** v1.16 — ícone info no sino (`notificacoes.tipo`). */
export const JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TIPO = 'info';

/**
 * Placeholder gravado na BD — a UI resolve copy via {@link resolvePassageiroJustaCausaInvocadorNotifCopy}.
 * Não mostrar literalmente no ecrã.
 */
export const JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_SQL_PLACEHOLDER = '·';

/**
 * @typedef {'parcial' | 'ultimo' | 'reservado'} JustaCausaInvocadorNotifVariant
 */

/**
 * @typedef {{ titulo: string, corpo: string, tipo: 'info' }} PassageiroJustaCausaInvocadorNotifCopy
 */

/**
 * Copy v1.16 FINAL (PM + Critiquito) — passageiro invocador justa causa.
 *
 * @param {{ variant: JustaCausaInvocadorNotifVariant, lugarRescisaoEm?: string | null }} params
 * @returns {PassageiroJustaCausaInvocadorNotifCopy}
 */
export function resolvePassageiroJustaCausaInvocadorNotifCopy({
  variant,
  lugarRescisaoEm,
}) {
  const data = formatCivilDateLuandaPtNoYearFromIso(lugarRescisaoEm) || 'hoje';

  if (variant === 'ultimo') {
    return {
      titulo: 'Acordo encerrado',
      corpo:
        `Saíste por justa causa a ${data}. Eras o último passageiro, por isso o acordo foi encerrado. `
        + 'Só contam os dias até essa data. Se já pagaste mais, devolvemos-te a diferença.',
      tipo: JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TIPO,
    };
  }

  return {
    titulo: 'Saíste do acordo',
    corpo:
      `Terminaste o teu lugar por justa causa a ${data}. `
      + 'Só contam os dias até essa data. Se já pagaste mais, devolvemos-te a diferença.',
    tipo: JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TIPO,
  };
}

/**
 * @param {{ variant: JustaCausaInvocadorNotifVariant, lugarRescisaoEm?: string | null }} params
 * @returns {string}
 */
export function resolvePassageiroJustaCausaInvocadorNotifMensagem(params) {
  return resolvePassageiroJustaCausaInvocadorNotifCopy(params).corpo;
}

/**
 * @param {object | null | undefined} metadata
 * @returns {JustaCausaInvocadorNotifVariant | null}
 */
export function parseJustaCausaInvocadorNotifVariant(metadata) {
  const raw = metadata?.variant;
  if (raw === 'parcial' || raw === 'ultimo' || raw === 'reservado') {
    return raw;
  }
  return null;
}
