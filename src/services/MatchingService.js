import { supabase } from '../lib/supabase';
import { evaluateMatch } from '../utils/matchingFilters';

/**
 * @param {object} oferta
 * @returns {{
 *   departure_time: string,
 *   origin_lat: number | null,
 *   origin_lng: number | null,
 *   destination_lat: number | null,
 *   destination_lng: number | null,
 *   vagas_disponiveis: number,
 *   flexibilidade_rota: boolean,
 *   dias_semana: number[] | null,
 * }}
 */
function toOfertaMatchInput(oferta) {
  const isFlex = Boolean(oferta?.flexibilidade_rota);
  return {
    departure_time: String(oferta.departure_time).slice(0, 5),
    origin_lat:
      oferta.origin_lat != null && oferta.origin_lat !== ''
        ? Number(oferta.origin_lat)
        : null,
    origin_lng:
      oferta.origin_lng != null && oferta.origin_lng !== ''
        ? Number(oferta.origin_lng)
        : null,
    destination_lat:
      oferta.destination_lat != null && oferta.destination_lat !== ''
        ? Number(oferta.destination_lat)
        : null,
    destination_lng:
      oferta.destination_lng != null && oferta.destination_lng !== ''
        ? Number(oferta.destination_lng)
        : null,
    vagas_disponiveis: oferta.vagas_disponiveis,
    flexibilidade_rota: isFlex,
    dias_semana: Array.isArray(oferta.dias_semana) ? oferta.dias_semana : null,
  };
}

/**
 * @param {object} procura
 * @returns {{
 *   preferred_time: string,
 *   origin_lat: number | null,
 *   origin_lng: number | null,
 *   destination_lat: number | null,
 *   destination_lng: number | null,
 *   dias_semana: number[] | null,
 * }}
 */
function toProcuraMatchInput(procura) {
  return {
    preferred_time: String(procura.preferred_time).slice(0, 5),
    origin_lat:
      procura.origin_lat != null && procura.origin_lat !== ''
        ? Number(procura.origin_lat)
        : null,
    origin_lng:
      procura.origin_lng != null && procura.origin_lng !== ''
        ? Number(procura.origin_lng)
        : null,
    destination_lat:
      procura.destination_lat != null && procura.destination_lat !== ''
        ? Number(procura.destination_lat)
        : null,
    destination_lng:
      procura.destination_lng != null && procura.destination_lng !== ''
        ? Number(procura.destination_lng)
        : null,
    dias_semana: Array.isArray(procura.dias_semana) ? procura.dias_semana : null,
  };
}

/**
 * Encontra ofertas compatíveis com uma procura/grupo (sem routing).
 * Fixa: tempo ±15 + dias + geo OD 2500 m + capacidade (`N_actual`/`n_candidato`).
 * Flexível: tempo + dias + capacidade — **sem** OD / residência.
 * Dias: intersecção real obrigatória; lado vazio/ausente → incompatível.
 * Capacidade: N ≤ vagas → `direct`; N > vagas → `waitlist` (nunca auto-aceitar).
 * @param {{
 *   preferred_time: string,
 *   origin_lat: number,
 *   origin_lng: number,
 *   destination_lat: number,
 *   destination_lng: number,
 *   n_candidato: number,
 *   dias_semana?: number[] | null,
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
  const procuraInput = toProcuraMatchInput(procura);

  for (const oferta of ofertas || []) {
    const outcome = evaluateMatch({
      oferta: toOfertaMatchInput(oferta),
      procura: procuraInput,
      n_candidato: procura.n_candidato,
    });

    if (outcome === 'direct') direct.push(oferta);
    else if (outcome === 'waitlist') waitlist.push(oferta);
    else incompatible.push(oferta);
  }

  return { direct, waitlist, incompatible };
}

/**
 * Encontra procuras compatíveis com uma oferta (sentido B — motorista propõe).
 * Fixa: geo + tempo via `evaluateMatch`.
 * Flexível: tempo/dias/capacidade **sem** OD/residência.
 * Dias: intersecção real obrigatória; lado vazio/ausente → incompatível.
 *
 * @param {{
 *   departure_time: string,
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 *   vagas_disponiveis: number,
 *   flexibilidade_rota?: boolean,
 *   dias_semana?: number[] | null,
 * }} oferta
 * @returns {Promise<{
 *   direct: object[],
 *   waitlist: object[],
 *   incompatible: object[],
 * }>}
 */
export async function findCompatibleProcuras(oferta) {
  const isFlex = Boolean(oferta?.flexibilidade_rota);
  const hasOd =
    oferta?.origin_lat != null &&
    oferta?.origin_lng != null &&
    oferta?.destination_lat != null &&
    oferta?.destination_lng != null;

  if (!oferta?.departure_time) {
    return { direct: [], waitlist: [], incompatible: [] };
  }

  // Fixa sem OD completa → não há match geo
  if (!isFlex && !hasOd) {
    return { direct: [], waitlist: [], incompatible: [] };
  }

  const { data: procuras, error } = await supabase
    .from('procuras')
    .select('*')
    .in('estado', ['activa', 'em_negociacao']);

  if (error) throw error;

  const direct = [];
  const waitlist = [];
  const incompatible = [];
  const ofertaInput = toOfertaMatchInput(oferta);

  for (const procura of procuras || []) {
    const outcome = evaluateMatch({
      oferta: ofertaInput,
      procura: toProcuraMatchInput(procura),
      n_candidato: procura.n_candidato,
    });

    if (outcome === 'direct') direct.push(procura);
    else if (outcome === 'waitlist') waitlist.push(procura);
    else incompatible.push(procura);
  }

  return { direct, waitlist, incompatible };
}
