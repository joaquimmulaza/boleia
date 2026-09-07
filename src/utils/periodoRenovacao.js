/**
 * Estados e copy de renovação de período (PACOTE ENG #14).
 */

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function labelRenovacaoEstado(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'renovado') return 'Período seguinte renovado';
  if (e === 'nao_renovar') return 'Termina no fim deste ciclo';
  return 'Renovação pendente';
}

/**
 * @param {{ estado?: string, renovacao_estado?: string | null } | null | undefined} acordo
 * @returns {boolean}
 */
export function podeRenovarPeriodo(acordo) {
  if (!acordo) return false;
  if (String(acordo.estado || '').toLowerCase() !== 'activo') return false;
  const re = String(acordo.renovacao_estado || '').toLowerCase();
  if (re === 'renovado' || re === 'nao_renovar') return false;
  return true;
}

/**
 * @param {{ estado?: string, renovacao_estado?: string | null } | null | undefined} acordo
 * @returns {boolean}
 */
export function podeRecusarRenovacao(acordo) {
  if (!acordo) return false;
  if (String(acordo.estado || '').toLowerCase() !== 'activo') return false;
  if (String(acordo.renovacao_estado || '').toLowerCase() === 'renovado') return false;
  if (String(acordo.renovacao_estado || '').toLowerCase() === 'nao_renovar') return false;
  return true;
}

/**
 * @param {string | null | undefined} mesIso Primeiro dia do mês (YYYY-MM-DD)
 * @returns {string}
 */
export function formatProximoMesPt(mesIso) {
  if (!mesIso) return '—';
  const d = new Date(`${mesIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return mesIso;
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}
