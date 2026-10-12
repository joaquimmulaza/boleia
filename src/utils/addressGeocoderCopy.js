/** @param {string} text */
export const formatUseFreeTextLabel = (text) => {
  const trimmed = String(text || '').trim();
  return `Usar “${trimmed}”`;
};

export const EMPTY_GEOCODER_MESSAGE =
  'Não encontrámos este local. Podes usar o que escreveste.';

/** Aviso após «Usar …» sem coordenadas (criar/editar procura). */
export const FLEX_ONLY_FREE_TEXT_WARNING =
  'Como este local não está no mapa, só as ofertas sem percurso fixo aparecem como compatíveis. Para veres mais, escolhe uma sugestão da lista.';

/** Falha de rede no geocoder (distinct de «sem resultados»). */
export const GEOCODER_NETWORK_ERROR_MESSAGE =
  'Não foi possível procurar locais. Verifica a ligação e tenta outra vez.';

export const GEOCODER_RETRY_LABEL = 'Tentar outra vez';

/** Campo OD por resolver (inline submit bloqueado) — v1.4. */
export const GEOCODER_FIELD_UNRESOLVED_TODO =
  'Escolhe um local da lista ou usa o que escreveste.';

/** @deprecated alias — usar GEOCODER_FIELD_UNRESOLVED_TODO */
export const GEOCODER_FIELD_UNRESOLVED_PROVISIONAL = GEOCODER_FIELD_UNRESOLVED_TODO;

/** Alias histórico de spec — copy final = GEOCODER_NETWORK_ERROR_MESSAGE */
export const GEOCODER_NETWORK_ERROR_TODO = GEOCODER_NETWORK_ERROR_MESSAGE;
