/** Fração da altura do sheet que fecha ao soltar. */
export const SHEET_DISMISS_DISTANCE_RATIO = 0.28;

/** Velocidade para baixo (px/ms) que conta como flick. */
export const SHEET_DISMISS_VELOCITY_PX_MS = 0.75;

/** Percurso mínimo para um flick não fechar num micro-movimento. */
export const SHEET_FLICK_MIN_DISTANCE_PX = 24;

/** Movimento mínimo antes de decidir o eixo do gesto. */
export const SHEET_AXIS_LOCK_PX = 10;

/** Duração da volta ao lugar, em ms. */
export const SHEET_SNAP_MS = 380;

export const SHEET_DISMISS_MS_MIN = 180;
export const SHEET_DISMISS_MS_MAX = 420;

/** Altura usada quando o layout ainda não mediu o painel. */
export const SHEET_HEIGHT_FALLBACK_PX = 320;

/** Piso de velocidade para a duração de fecho não esticar demais. */
const DISMISS_SPEED_FLOOR_PX_MS = 0.8;

export const SHEET_SNAP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const SHEET_DISMISS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * @param {number} measuredHeight
 * @returns {number}
 */
export function resolveSheetHeight(measuredHeight) {
  return measuredHeight > 0 ? measuredHeight : SHEET_HEIGHT_FALLBACK_PX;
}

/**
 * @param {number} dy
 * @returns {number}
 */
export function clampDragY(dy) {
  return Math.max(0, dy);
}

/**
 * Lê o deslocamento vertical de um `transform` (matrix, translate3d ou translateY).
 * @param {string | null | undefined} transform
 * @returns {number}
 */
export function readTranslateY(transform) {
  if (!transform || transform === 'none') return 0;
  const translate3d = transform.match(/translate3d\(\s*[^,]+,\s*(-?[\d.]+)px/i);
  if (translate3d) return Number(translate3d[1]);
  const translateY = transform.match(/translateY\(\s*(-?[\d.]+)px\)/i);
  if (translateY) return Number(translateY[1]);
  const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
  if (matrix3d) {
    const parts = matrix3d[1].split(',');
    return Number.parseFloat(parts[13]) || 0;
  }
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (matrix) {
    const parts = matrix[1].split(',');
    return Number.parseFloat(parts[5]) || 0;
  }
  return 0;
}

/**
 * @param {number} dragY
 * @param {number} sheetHeight
 * @returns {number}
 */
export function backdropOpacity(dragY, sheetHeight) {
  const height = resolveSheetHeight(sheetHeight);
  const progress = Math.min(1, Math.max(0, dragY / height));
  return 1 - progress;
}

/**
 * @param {number} dx
 * @param {number} dy
 * @param {number} [lockPx]
 * @returns {boolean}
 */
export function isHorizontalGesture(dx, dy, lockPx = SHEET_AXIS_LOCK_PX) {
  return Math.abs(dx) > lockPx && Math.abs(dx) > Math.abs(dy);
}

/**
 * @param {number} dx
 * @param {number} dy
 * @param {number} [lockPx]
 * @returns {boolean}
 */
export function passedAxisLock(dx, dy, lockPx = SHEET_AXIS_LOCK_PX) {
  return Math.abs(dx) > lockPx || Math.abs(dy) > lockPx;
}

/**
 * @param {{ dragY: number, sheetHeight: number, velocityY: number }} input
 * @returns {boolean}
 */
export function shouldDismissSheet({ dragY, sheetHeight, velocityY }) {
  const height = resolveSheetHeight(sheetHeight);
  const y = clampDragY(dragY);
  if (y >= height * SHEET_DISMISS_DISTANCE_RATIO) return true;
  if (velocityY >= SHEET_DISMISS_VELOCITY_PX_MS && y >= SHEET_FLICK_MIN_DISTANCE_PX) return true;
  return false;
}

/**
 * @param {{ dragY: number, sheetHeight: number, velocityY: number, reducedMotion?: boolean }} input
 * @returns {number}
 */
export function dismissDurationMs({ dragY, sheetHeight, velocityY, reducedMotion = false }) {
  if (reducedMotion) return 0;
  const height = resolveSheetHeight(sheetHeight);
  const remaining = Math.max(0, height - clampDragY(dragY));
  const speed = Math.max(velocityY, DISMISS_SPEED_FLOOR_PX_MS);
  const duration = remaining / speed;
  return Math.min(SHEET_DISMISS_MS_MAX, Math.max(SHEET_DISMISS_MS_MIN, duration));
}
