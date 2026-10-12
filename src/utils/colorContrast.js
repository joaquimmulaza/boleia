/**
 * Contraste WCAG entre duas cores hex (#RRGGBB).
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number}
 */
export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * @param {string} hex
 * @returns {number}
 */
function relativeLuminance(hex) {
  const rgb = hex.replace('#', '').match(/.{2}/g);
  if (!rgb || rgb.length !== 3) {
    throw new Error(`Cor inválida: ${hex}`);
  }
  const [r, g, b] = rgb.map((pair) => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tokens :root em src/index.css (modo claro). */
export const LIGHT_INPUT_BORDER = '#718096';
export const LIGHT_INPUT_SURFACE = '#ffffff';
