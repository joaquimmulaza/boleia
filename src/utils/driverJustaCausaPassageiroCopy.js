import { ADENDA_TIMEZONE } from './adendaEffectiveFrom.js';
import { formatPrimeiroNome } from './primeiroNome';
import { formatDateLuandaPt } from './rescisaoDisplay';

/**
 * v1.10 — motorista, detalhe do acordo, passageiro invocou justa causa (outros vivos).
 *
 * @param {{ nome: string, dataFormatada: string }} params
 * @returns {string}
 */
export function copyMotoristaJustaCausaParcial({ nome, dataFormatada }) {
  return `O lugar de ${nome} terminou por justa causa a ${dataFormatada}. Recebes a parte do mês desse lugar até essa data, menos a comissão da Boleia Certa. Os outros passageiros continuam no acordo e não há penalização para ti.`;
}

/**
 * v1.10 — motorista, último passageiro por justa causa (acordo encerrado).
 *
 * @param {{ nome: string, dataFormatada: string }} params
 * @returns {string}
 */
export function copyMotoristaJustaCausaUltimoPassageiro({ nome, dataFormatada }) {
  return `O lugar de ${nome} terminou por justa causa a ${dataFormatada}, e o acordo foi encerrado porque era o último passageiro. Recebes a parte do mês até essa data, menos a comissão da Boleia Certa. A tua oferta continua publicada e não há penalização para ti.`;
}

/**
 * @param {string | null | undefined} iso
 * @returns {string}
 */
function dataRescisaoLugarFormatada(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: ADENDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return formatDateLuandaPt(datePart) || datePart;
}

/**
 * @param {object[]} jcLinhas
 * @returns {object | null}
 */
function pickLugarRescisaoJustaCausaMaisRecente(jcLinhas) {
  if (!jcLinhas.length) return null;
  return jcLinhas.reduce((best, row) => {
    const tBest = best?.lugar_rescisao_em
      ? new Date(best.lugar_rescisao_em).getTime()
      : 0;
    const tRow = row?.lugar_rescisao_em ? new Date(row.lugar_rescisao_em).getTime() : 0;
    if (!best || tRow >= tBest) return row;
    return best;
  }, null);
}

/**
 * @param {object | null | undefined} pax
 * @returns {string}
 */
function nomeMotoristaUi(pax) {
  const raw = pax?.perfis?.nome_completo || pax?.nome_completo || 'Passageiro';
  return formatPrimeiroNome(raw) || 'Passageiro';
}

/**
 * Alertas no detalhe do acordo (vista motorista).
 *
 * @param {object | null | undefined} acordo
 * @param {object[] | null | undefined} linhas
 * @returns {{ id: string, variant: 'B' | 'B2', corpo: string }[]}
 */
export function resolveMotoristaJustaCausaPassageiroAlerts(acordo, linhas) {
  if (!acordo || !Array.isArray(linhas) || linhas.length === 0) {
    return [];
  }

  const estado = String(acordo.estado || '').toLowerCase();
  const motivo = acordo.encerramento_motivo;
  const ultimoEncerrado =
    estado === 'cancelado' && motivo === 'sem_lugares_vivos';

  const jcLinhas = linhas.filter(
    (p) => String(p.lugar_rescisao_modo || '').toLowerCase() === 'justa_causa',
  );
  const jcUltimoRow = ultimoEncerrado
    ? pickLugarRescisaoJustaCausaMaisRecente(jcLinhas)
    : null;
  const jcUltimoId = jcUltimoRow
    ? String(jcUltimoRow.id || jcUltimoRow.passenger_id || '')
    : '';

  return jcLinhas
    .map((p) => {
      const nome = nomeMotoristaUi(p);
      const dataFormatada = dataRescisaoLugarFormatada(p.lugar_rescisao_em);
      const rowId = String(p.id || p.passenger_id);
      const variant =
        ultimoEncerrado && rowId === jcUltimoId ? 'B2' : 'B';
      const corpo =
        variant === 'B2'
          ? copyMotoristaJustaCausaUltimoPassageiro({ nome, dataFormatada })
          : copyMotoristaJustaCausaParcial({ nome, dataFormatada });
      return {
        id: rowId,
        variant,
        corpo,
      };
    })
    .filter((a) => {
      if (a.variant === 'B2') return ultimoEncerrado;
      return estado === 'activo' || estado === 'cancelamento_pendente' || ultimoEncerrado;
    });
}
