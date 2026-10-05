import { labelRotaProcura } from './ofertaLabels';

/**
 * Aviso antes de propor no Explorar quando a rota não bate com a procura activa.
 * @param {{ origin_name?: string | null, destination_name?: string | null }} oferta
 * @param {{
 *   origin_name?: string | null,
 *   destination_name?: string | null,
 *   origin_lat?: number | null,
 *   destination_lat?: number | null,
 * }} procura
 * @returns {string}
 */
export function buildAvisoProporRota(oferta, procura) {
  const ofertaTexto = oferta?.origin_name && oferta?.destination_name
    ? `vai de ${oferta.origin_name} a ${oferta.destination_name}`
    : 'não tem origem e destino fixos';
  const rota = labelRotaProcura(procura);
  const procuraTexto = rota.origem === 'Procura flexível'
    ? 'não tem origem e destino fixos'
    : `é ${rota.origem} → ${rota.destino}`;
  return `Esta oferta ${ofertaTexto} e a tua procura ${procuraTexto}. Queres propor na mesma?`;
}
