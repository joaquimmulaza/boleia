/** @param {string} text */
export const formatUseFreeTextLabel = (text) => {
  const trimmed = String(text || '').trim();
  return `Usar “${trimmed}”`;
};

export const EMPTY_GEOCODER_MESSAGE =
  'Não encontrámos este local. Podes usar o que escreveste.';

/** Placeholder até copywriter — sem local exacto implica matching flexível. */
export const FLEX_ONLY_FREE_TEXT_WARNING_TODO =
  'TODO(Copywriter): aviso de que, sem local exacto, só surgem ofertas flexíveis.';
