import { supabase } from '../lib/supabase';
import { evaluateMatch } from '../utils/matchingFilters';

/**
 * Encontra ofertas compatíveis com uma procura/grupo (sem routing).
 * @param {{
 *   preferred_time: string,
 *   origin_lat: number,
 *   origin_lng: number,
 *   destination_lat: number,
 *   destination_lng: number,
 *   n_candidato: number,
 * }} procura
 * @returns {Promise<{
 *   direct: object[],
 *   waitlist: object[],
 *   incompatible: object[],
 * }>}
 */
export async function findCompatibleOfertas(procura) {
  const { data: ofertas, error } = await supabase
    .from('ofertas_capacidade')
    .select('*')
    .in('estado', ['disponivel', 'parcial', 'cheia']);

  if (error) throw error;

  const direct = [];
  const waitlist = [];
  const incompatible = [];

  for (const oferta of ofertas || []) {
    const outcome = evaluateMatch({
      oferta: {
        departure_time: String(oferta.departure_time).slice(0, 5),
        origin_lat: Number(oferta.origin_lat),
        origin_lng: Number(oferta.origin_lng),
        destination_lat: Number(oferta.destination_lat),
        destination_lng: Number(oferta.destination_lng),
        vagas_disponiveis: oferta.vagas_disponiveis,
      },
      procura: {
        preferred_time: String(procura.preferred_time).slice(0, 5),
        origin_lat: Number(procura.origin_lat),
        origin_lng: Number(procura.origin_lng),
        destination_lat: Number(procura.destination_lat),
        destination_lng: Number(procura.destination_lng),
      },
      n_candidato: procura.n_candidato,
    });

    if (outcome === 'direct') direct.push(oferta);
    else if (outcome === 'waitlist') waitlist.push(oferta);
    else incompatible.push(oferta);
  }

  return { direct, waitlist, incompatible };
}
