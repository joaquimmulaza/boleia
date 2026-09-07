import { ADENDA_TIMEZONE } from './adendaEffectiveFrom.js';

/**
 * Formata data ISO (YYYY-MM-DD) em pt-PT com fuso Africa/Luanda.
 * @param {string | null | undefined} isoDate
 * @returns {string | null}
 */
export function formatDateLuandaPt(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ADENDA_TIMEZONE,
  });
}

/**
 * Último dia do ciclo antes de rescisao_effective_on (dia anterior ao 1.º do mês seguinte).
 * @param {string | null | undefined} rescisaoEffectiveOn — YYYY-MM-DD (1.º dia do mês seguinte)
 * @returns {string | null} YYYY-MM-DD
 */
export function lastDayOfRescisaoCycle(rescisaoEffectiveOn) {
  if (!rescisaoEffectiveOn) return null;
  const base = String(rescisaoEffectiveOn).slice(0, 10);
  const [y, m] = base.split('-').map(Number);
  if (!y || !m) return null;
  const last = new Date(Date.UTC(y, m - 1, 0));
  return last.toISOString().slice(0, 10);
}

/**
 * Copy do banner cancelamento_pendente.
 * @param {string | null | undefined} rescisaoEffectiveOn
 * @returns {{ titulo: string, corpo: string } | null}
 */
export function copyCancelamentoPendente(rescisaoEffectiveOn) {
  const fimCiclo = lastDayOfRescisaoCycle(rescisaoEffectiveOn);
  const fimFormatado = formatDateLuandaPt(fimCiclo) || formatDateLuandaPt(rescisaoEffectiveOn);
  if (!fimFormatado) {
    return {
      titulo: 'Cancelamento pendente',
      corpo:
        'O acordo mantém-se activo até ao fim deste ciclo. Até lá, a vaga permanece ocupada e as quotas congeladas mantêm-se.',
    };
  }
  return {
    titulo: 'Cancelamento pendente',
    corpo:
      `O acordo termina a ${fimFormatado} (Luanda). Até lá, a vaga permanece ocupada e as quotas congeladas mantêm-se.`,
  };
}
