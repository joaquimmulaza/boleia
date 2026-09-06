import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase.js';
import { enqueueRpc, isNetworkFailure } from '../services/offlineQueue.js';

/**
 * Executa RPC Supabase com fallback offline (fila IndexedDB + Background Sync).
 * Preserva classificação de erros de rede vs negócio e semântica de forceQueue.
 *
 * @param {{
 *   rpc: string,
 *   rpcArgs: Record<string, unknown>,
 *   options?: { idempotencyKey?: string, forceQueue?: boolean },
 *   sessionErrorMessage: string,
 *   rpcErrorMessage: string,
 *   offlineResult: (idempotencyKey: string) => object,
 *   afterRpcSuccess?: (rpcData: unknown) => Promise<unknown>,
 * }} config
 * @returns {Promise<unknown>}
 */
export async function callRpcWithOfflineFallback(config) {
  const options = config.options || {};
  const idempotencyKey = options.idempotencyKey || uuidv4();

  const queue = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error(config.sessionErrorMessage);
    }
    await enqueueRpc({
      rpc: config.rpc,
      args: config.rpcArgs,
      accessToken,
      idempotencyKey,
    });
    return config.offlineResult(idempotencyKey);
  };

  if (options.forceQueue || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return queue();
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(config.rpc, config.rpcArgs);

    if (rpcError) {
      if (isNetworkFailure(rpcError)) {
        return queue();
      }
      throw new Error(rpcError.message || config.rpcErrorMessage);
    }

    if (config.afterRpcSuccess) {
      try {
        return await config.afterRpcSuccess(rpcData);
      } catch (err) {
        if (isNetworkFailure(err)) {
          return queue();
        }
        throw err;
      }
    }

    return rpcData;
  } catch (err) {
    if (isNetworkFailure(err)) {
      return queue();
    }
    throw err;
  }
}

/**
 * Gera chave de idempotência (expõe uuid para callers que montam rpcArgs antes do helper).
 * @param {string | undefined} [provided]
 * @returns {string}
 */
export function resolveIdempotencyKey(provided) {
  return provided || uuidv4();
}
