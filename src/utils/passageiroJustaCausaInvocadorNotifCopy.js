import { formatCivilDateLuandaPtFromIso } from './rescisaoDisplay';

/** Tipo em `notificacoes.metadata.type` (RPC `terminate_agreement`, ramo passageiro JC). */
export const JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_NOTIF_TYPE = 'justa_causa_passageiro_invocador';

/**
 * Placeholder gravado na BD — a UI resolve copy via {@link resolvePassageiroJustaCausaInvocadorNotifMensagem}.
 * Não mostrar literalmente no ecrã.
 */
export const JUSTA_CAUSA_PASSAGEIRO_INVOCADOR_SQL_PLACEHOLDER = '·';

/**
 * @typedef {'parcial' | 'ultimo' | 'reservado'} JustaCausaInvocadorNotifVariant
 */

/**
 * Copy in-app (sino) para o passageiro que invocou justa causa.
 *
 * TODO(Copywriter): substituir por copy oficial v1.10-B invocador quando existir no pacote copy.
 * Hoje só existe B/B2 na vista motorista (`driverJustaCausaPassageiroCopy.js`).
 *
 * @param {{ variant: JustaCausaInvocadorNotifVariant, lugarRescisaoEm?: string | null }} params
 * @returns {string}
 */
export function resolvePassageiroJustaCausaInvocadorNotifMensagem({
  variant,
  lugarRescisaoEm,
}) {
  const dataFormatada = formatCivilDateLuandaPtFromIso(lugarRescisaoEm) || 'hoje';

  if (variant === 'reservado') {
    return (
      `O teu lugar reservado terminou por justa causa a ${dataFormatada}. `
      + 'Não há pagamento pendente por este lugar.'
    );
  }

  if (variant === 'ultimo') {
    return (
      `O teu lugar terminou por justa causa a ${dataFormatada}, `
      + 'e o acordo foi encerrado porque eras o último passageiro. '
      + 'A tua quota deste mês ajusta-se até essa data.'
    );
  }

  return (
    `O teu lugar terminou por justa causa a ${dataFormatada}. `
    + 'A tua quota deste mês ajusta-se até essa data. '
    + 'Os outros passageiros continuam no acordo.'
  );
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
