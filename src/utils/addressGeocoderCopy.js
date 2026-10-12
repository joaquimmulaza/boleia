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

/** TODO(Copywriter): campo OD por resolver — escolher sugestão ou confirmar Usar. */
export const GEOCODER_FIELD_UNRESOLVED_TODO =
  'TODO(Copywriter): pedir sugestão da lista ou confirmar Usar quando o texto já não corresponde ao local escolhido.';

/** Copy provisória mostrada na UI (B5: nunca expor TODO). */
export const GEOCODER_FIELD_UNRESOLVED_PROVISIONAL = 'Escolhe um local da lista.';
