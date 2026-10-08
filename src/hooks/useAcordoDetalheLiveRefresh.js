import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/** Intervalo de polling com sheet aberto (ms). */
export const ACORDO_DETALHE_POLL_MS =
  typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'
    ? 100
    : 9000;

/**
 * Polling só enquanto o acordo está activo e há pedido consensual à espera da contraparte.
 * @param {object | null | undefined} acordo
 * @returns {boolean}
 */
export function acordoPrecisaLiveRefresh(acordo) {
  if (!acordo?.id) return false;
  const e = String(acordo.estado || '').toLowerCase();
  if (e !== 'activo') return false;
  const modo = String(acordo.rescisao_modo || '').toLowerCase();
  if (modo !== 'consensual') return false;
  return Boolean(acordo.rescisao_solicitada_por);
}

/**
 * Refetch silencioso enquanto o detalhe está aberto (rescisão consensual pendente).
 * @param {{ enabled: boolean, userId?: string, acordoId?: string, onRefresh: () => void }} opts
 */
export function useAcordoDetalheLiveRefresh({ enabled, userId, acordoId, onRefresh }) {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !userId || !acordoId) return undefined;

    const mountId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    /** @type {ReturnType<typeof setInterval> | null} */
    let intervalId = null;

    const tick = () => {
      if (document.hidden) return;
      onRefreshRef.current();
    };

    const startInterval = () => {
      if (intervalId != null || document.hidden) return;
      intervalId = window.setInterval(tick, ACORDO_DETALHE_POLL_MS);
    };

    const stopInterval = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onWindowFocus = () => {
      tick();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        tick();
        startInterval();
      }
    };

    startInterval();
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const channel = supabase.channel(`acordos-live-${userId}-${acordoId}-${mountId}`);
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
      stopInterval();
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [enabled, userId, acordoId]);
}
