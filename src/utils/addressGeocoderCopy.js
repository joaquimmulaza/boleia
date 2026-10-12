/** @param {string} text */
export const formatUseFreeTextLabel = (text) => {
  const trimmed = String(text || '').trim();
  return `Usar “${trimmed}”`;
};

export const EMPTY_GEOCODER_MESSAGE =
  'Não encontrámos este local. Podes usar o que escreveste.';
