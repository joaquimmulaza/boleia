import { supabase } from '../lib/supabase';

const BUCKET = 'comprovativos-pagamento';

/**
 * Pagamento mensal do passageiro num acordo.
 * @param {string} acordoId
 * @param {string} passengerId
 * @returns {Promise<object | null>}
 */
export async function getPagamentoForPassageiro(acordoId, passengerId) {
  const { data, error } = await supabase
    .from('pagamentos_acordo')
    .select('*')
    .eq('acordo_id', acordoId)
    .eq('passenger_id', passengerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Lista pagamentos de um acordo (motorista ou participante).
 * @param {string} acordoId
 * @returns {Promise<object[]>}
 */
export async function listPagamentosByAcordo(acordoId) {
  const { data, error } = await supabase
    .from('pagamentos_acordo')
    .select('*')
    .eq('acordo_id', acordoId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Admin: fila de comprovativos à espera de validação.
 * @returns {Promise<object[]>}
 */
/**
 * Admin: pagamentos em custódia prontos para liquidação.
 * @returns {Promise<object[]>}
 */
export async function listPagamentosEmCustodia() {
  const { data, error } = await supabase
    .from('pagamentos_acordo')
    .select('*, acordos(oferta_id, driver_id), perfis!pagamentos_acordo_passenger_id_fkey(nome_completo, telefone)')
    .eq('estado', 'em_custodia')
    .order('validado_em', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Admin liquida pagamento (repasse ao motorista menos faltas on-platform).
 * @param {string} pagamentoId
 * @returns {Promise<string>}
 */
/**
 * Admin liquida um pagamento (idempotente).
 * @param {string} pagamentoId
 * @param {string | null} [idempotencyKey]
 * @returns {Promise<string>}
 */
export async function adminLiquidatePayment(pagamentoId, idempotencyKey = null) {
  const { data, error } = await supabase.rpc('admin_liquidate_payment', {
    p_pagamento_id: pagamentoId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data;
}

/**
 * Admin liquida todos os pagamentos em custódia de um período (batch).
 * @param {string} mesReferencia ISO date (1.º dia do mês)
 * @param {string | null} [driverId] opcional — só um motorista
 * @param {string | null} [idempotencyKey]
 * @returns {Promise<{ mes_referencia: string, pagamentos_liquidados: number, repasses: object[] }>}
 */
export async function adminLiquidatePeriod(mesReferencia, driverId = null, idempotencyKey = null) {
  const { data, error } = await supabase.rpc('admin_liquidate_period', {
    p_mes_referencia: mesReferencia,
    p_driver_id: driverId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data || { mes_referencia: mesReferencia, pagamentos_liquidados: 0, repasses: [] };
}

/**
 * Admin: repasses registados (liquidação de período).
 * @returns {Promise<object[]>}
 */
export async function listRepassesMotorista() {
  const { data, error } = await supabase
    .from('repasses_motorista')
    .select('*, perfis!repasses_motorista_driver_id_fkey(nome_completo, iban, iban_titular)')
    .order('liquidado_em', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listPagamentosPendentesValidacao() {
  const { data, error } = await supabase
    .from('pagamentos_acordo')
    .select('*, acordos(oferta_id, driver_id), perfis!pagamentos_acordo_passenger_id_fkey(nome_completo, telefone)')
    .eq('estado', 'comprovativo_enviado')
    .order('comprovativo_enviado_em', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Passageiro regista path do comprovativo (após upload Storage).
 * @param {string} pagamentoId
 * @param {string} storagePath
 * @returns {Promise<string>}
 */
export async function submitPaymentProof(pagamentoId, storagePath) {
  const { data, error } = await supabase.rpc('submit_payment_proof', {
    p_pagamento_id: pagamentoId,
    p_storage_path: storagePath,
  });

  if (error) throw error;
  return data;
}

/**
 * Passageiro faz upload do comprovativo e submete para validação.
 * @param {string} pagamentoId
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadComprovativo(pagamentoId, file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sessão necessária para enviar comprovativo.');
  }

  const safeName = String(file.name || 'comprovativo').replace(/[^\w.-]+/g, '_');
  const path = `${user.id}/${pagamentoId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (uploadError) throw uploadError;

  return submitPaymentProof(pagamentoId, path);
}

/**
 * Admin aprova ou rejeita comprovativo.
 * @param {string} pagamentoId
 * @param {boolean} aprovar
 * @param {string | null} [motivo]
 * @returns {Promise<string>}
 */
export async function adminValidatePayment(pagamentoId, aprovar, motivo = null) {
  const { data, error } = await supabase.rpc('admin_validate_payment', {
    p_pagamento_id: pagamentoId,
    p_aprovar: aprovar,
    p_motivo: motivo,
  });

  if (error) throw error;
  return data;
}

/**
 * Contactos do acordo — hard-gate até em_custodia (RPC SECURITY DEFINER).
 * @param {string} acordoId
 * @returns {Promise<{
 *   bloqueado: boolean,
 *   motivo?: string,
 *   motorista?: { nome_completo?: string, telefone?: string | null } | null,
 *   passageiros?: Array<{ passenger_id: string, nome_completo?: string, telefone?: string | null }>,
 * }>}
 */
export async function getAcordoContactos(acordoId) {
  const { data, error } = await supabase.rpc('get_acordo_contactos', {
    p_acordo_id: acordoId,
  });

  if (error) throw error;
  return data || { bloqueado: true, passageiros: [] };
}

/**
 * IBAN da plataforma (transferência manual MVP) — env, não default de preço.
 * @returns {string | null}
 */
export function getPlatformIban() {
  const iban = import.meta.env.VITE_PLATFORM_IBAN;
  if (typeof iban !== 'string' || !iban.trim()) {
    return null;
  }
  return iban.trim();
}

/**
 * URL assinada para preview do comprovativo (bucket privado).
 * @param {string | null | undefined} storagePath
 * @returns {Promise<string | null>}
 */
export async function getComprovativoSignedUrl(storagePath) {
  if (typeof storagePath !== 'string' || !storagePath.trim()) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath.trim(), 300);

  if (error) throw error;
  return data?.signedUrl ?? null;
}
