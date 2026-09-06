/**
 * Formata hora ISO/time para HH:mm (24h) na UI PT.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatTime24h(value) {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return raw.slice(0, 5);
  const hours = Number(match[1]);
  const minutes = match[2];
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return `${match[1]}:${minutes}`;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Ida e regresso quando ambos existem — ex.: «07:00 → 17:00».
 * @param {string | null | undefined} departure
 * @param {string | null | undefined} returnTime
 * @returns {string}
 */
export function formatIdaRegresso(departure, returnTime) {
  const ida = formatTime24h(departure);
  const regresso = formatTime24h(returnTime);
  if (!ida) return '';
  if (!regresso) return ida;
  return `${ida} → ${regresso}`;
}
