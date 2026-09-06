import { supabase } from '../lib/supabase';
import { MODOS_PRECO } from '../utils/modosPreco';

/**
 * @param {{ flexibilidade_rota?: boolean } | null | undefined} oferta
 * @returns {boolean}
 */
export function isOfertaFlexivel(oferta) {
  return Boolean(oferta?.flexibilidade_rota);
}

/**
 * Label humana para lista — flexível nunca inventa OD.
 * Fixa devolve `null` (a UI mostra origem → destino).
 * @param {{ flexibilidade_rota?: boolean } | null | undefined} oferta
 * @returns {string | null}
 */
export function labelOfertaRota(oferta) {
  if (isOfertaFlexivel(oferta)) return 'Oferta flexível';
  return null;
}

/**
 * Oferta fixa exige OD com coordenadas; flexível grava sem OD (null).
 * @param {object} formData
 * @returns {{
 *   origin_name: string|null,
 *   origin_lat: number|null,
 *   origin_lng: number|null,
 *   destination_name: string|null,
 *   destination_lat: number|null,
 *   destination_lng: number|null,
 * }}
 */
function resolveOdFields(formData) {
  const isFlex = Boolean(formData.flexibilidade_rota);
  if (isFlex) {
    return {
      origin_name: null,
      origin_lat: null,
      origin_lng: null,
      destination_name: null,
      destination_lat: null,
      destination_lng: null,
    };
  }

  const hasOd =
    formData.origin_name &&
    formData.origin_lat != null &&
    formData.origin_lng != null &&
    formData.destination_name &&
    formData.destination_lat != null &&
    formData.destination_lng != null;

  if (!hasOd) {
    throw new Error('Oferta fixa exige origem e destino com coordenadas.');
  }

  return {
    origin_name: formData.origin_name,
    origin_lat: formData.origin_lat,
    origin_lng: formData.origin_lng,
    destination_name: formData.destination_name,
    destination_lat: formData.destination_lat,
    destination_lng: formData.destination_lng,
  };
}

/**
 * @param {object} formData
 */
export async function createOferta(formData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Não autenticado.');
  }

  if (!MODOS_PRECO.has(formData.modo_preco)) {
    throw new Error('Modo de preço inválido.');
  }

  const ask = Number(formData.valor_mensal_ask_kz);
  if (!Number.isInteger(ask) || ask < 0) {
    throw new Error('Valor mensal em Kz inválido.');
  }

  if (!formData.departure_time) {
    throw new Error('Horário de partida é obrigatório.');
  }

  const od = resolveOdFields(formData);

  const { data: veiculo, error: veiculoError } = await supabase
    .from('veiculos')
    .select('id, vagas_passageiros')
    .eq('id_motorista', user.id)
    .single();

  if (veiculoError || !veiculo) {
    throw new Error('Registe o veículo antes de publicar uma oferta.');
  }
  if (veiculo.vagas_passageiros < 1) {
    throw new Error('O veículo precisa de pelo menos 1 vaga para passageiros.');
  }

  const vagas = veiculo.vagas_passageiros;
  const row = {
    driver_id: user.id,
    veiculo_id: formData.veiculo_id || veiculo.id,
    vagas_totais: vagas,
    vagas_disponiveis: vagas,
    modo_preco: formData.modo_preco,
    valor_mensal_ask_kz: ask,
    flexibilidade_rota: Boolean(formData.flexibilidade_rota),
    ...od,
    departure_time: formData.departure_time,
    return_time: formData.return_time ?? null,
    dias_semana: formData.dias_semana ?? [1, 2, 3, 4, 5],
    estado: 'disponivel',
  };

  const { data, error } = await supabase
    .from('ofertas_capacidade')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} driverId
 */
export async function listOfertasByDriver(driverId) {
  const { data, error } = await supabase
    .from('ofertas_capacidade')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * @param {string} ofertaId
 */
export async function getOferta(ofertaId) {
  const { data, error } = await supabase
    .from('ofertas_capacidade')
    .select('*')
    .eq('id', ofertaId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} ofertaId
 * @param {object} updates
 */
export async function updateOferta(ofertaId, updates) {
  const allowed = { ...updates };
  delete allowed.vagas_totais;
  delete allowed.driver_id;
  delete allowed.id;

  const { data, error } = await supabase
    .from('ofertas_capacidade')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', ofertaId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
