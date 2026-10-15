/** @type {string} */
export const TIME_INPUT_INVALID_MESSAGE =
  'Hora inválida — usa o formato 24h (00:00–23:59).';

/**
 * Extrai até 4 dígitos para máscara HH:MM.
 * @param {string} raw
 * @returns {string}
 */
export function digitsFromTimeInput(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 4);
}

/**
 * @param {string} digits
 * @returns {string}
 */
export function maskTimeInputFromDigits(digits) {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function maskTimeInputRaw(raw) {
  return maskTimeInputFromDigits(digitsFromTimeInput(raw));
}

/**
 * @param {string | null | undefined} value
 * @returns {boolean}
 */
export function isValidTime24h(value) {
  const m = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return Number.isInteger(h) && Number.isInteger(min) && h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeTime24h(value) {
  if (!isValidTime24h(value)) return null;
  const [h, min] = String(value).trim().split(':');
  return `${String(Number(h)).padStart(2, '0')}:${min.padStart(2, '0')}`;
}
