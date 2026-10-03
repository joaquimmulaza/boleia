/**
 * Dias da semana em formato ISO (1=Seg … 7=Dom).
 * Partilhado entre PublishRoute e PassengerDashboard para picker de dias.
 */
export const DIAS_SEMANA = [
  { valor: 1, label: 'Seg' },
  { valor: 2, label: 'Ter' },
  { valor: 3, label: 'Qua' },
  { valor: 4, label: 'Qui' },
  { valor: 5, label: 'Sex' },
  { valor: 6, label: 'Sáb' },
  { valor: 7, label: 'Dom' },
];

/** Dias úteis (Seg–Sex) por omissão. */
export const DIAS_UTEIS_DEFAULT = [1, 2, 3, 4, 5];

const LABEL_POR_DIA = Object.fromEntries(DIAS_SEMANA.map((dia) => [dia.valor, dia.label]));

/**
 * Intervalo compacto (Seg–Sex) ou lista (Seg, Qua). Vazio se não houver dias.
 * @param {number[] | null | undefined} dias
 * @returns {string}
 */
export function formatDiasSemana(dias) {
  if (!Array.isArray(dias) || dias.length === 0) return '';
  const sorted = [...new Set(dias.map((dia) => Number(dia)))]
    .filter((dia) => LABEL_POR_DIA[dia])
    .sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const consecutivo = sorted.every((dia, index) => index === 0 || dia === sorted[index - 1] + 1);
  if (sorted.length >= 2 && consecutivo) {
    return `${LABEL_POR_DIA[sorted[0]]}–${LABEL_POR_DIA[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((dia) => LABEL_POR_DIA[dia]).join(', ');
}
