import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/** Intervalo de polling com sheet aberto (ms). */
export const ACORDO_DETALHE_POLL_MS =
  typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'
    ? 100
    : 9000;

/**
 * @param {object | null | undefined} acordo
 * @returns {boolean}
 */
export function acordoPrecisaLiveRefresh(acordo) {
  if (!acordo?.id) return false;
  const e = String(acordo.estado || '').toLowerCase();
  if (e === 'cancelamento_pendente') return true;
  if (e !== 'activo') return false;
  const modo = String(acordo.rescisao_modo || '').toLowerCase();
  if (modo !== 'consensual') return false;
  return Boolean(acordo.rescisao_solicitada_por);
}

/**
 * Refetch silencioso enquanto o detalhe está aberto (rescisão consensual / cancelamento pendente).
 * @param {{ enabled: boolean, userId?: string, acordoId?: string, onRefresh: () => void }} opts
 */
export function useAcordoDetalheLiveRefresh({ enabled, userId, acordoId, onRefresh }) {
  useEffect(() => {
    if (!enabled || !userId || !acordoId) return undefined;

    const tick = () => {
      onRefresh();
    };

    const onFocus = () => {
      tick();
    };

    window.addEventListener('focus', onFocus);

    const intervalId = window.setInterval(tick, ACORDO_DETALHE_POLL_MS);

    const channel = supabase.channel(`acordos-live-${userId}-${acordoId}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notificacoes',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new || payload.old;
        const meta = row?.metadata;
        const metaAcordoId = meta?.acordo_id || meta?.acordoId;
        if (metaAcordoId && String(metaAcordoId) !== String(acordoId)) return;
        const tipo = String(row?.tipo || row?.type || '').toLowerCase();
        if (
          metaAcordoId
          || tipo.includes('agreement')
          || tipo.includes('rescis')
          || tipo.includes('acordo')
        ) {
          tick();
        }
      },
    ).subscribe();

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [enabled, userId, acordoId, onRefresh]);
}
