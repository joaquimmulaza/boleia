import { drainQueue } from '../services/offlineQueue';

/** @typedef {import('../services/offlineQueue').drainQueue extends (...args: any) => Promise<infer R> ? R : never} OfflineDrainSummary */

export const OFFLINE_QUEUE_DRAINED = 'boleia:offline-queue-drained';

/** @param {OfflineDrainSummary} summary */
export function broadcastOfflineQueueSummary(summary) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OFFLINE_QUEUE_DRAINED, {
      detail: { summary: summary || {} },
    }),
  );
}

let drainInFlight = /** @type {Promise<OfflineDrainSummary> | null} */ (null);

/**
 * Drena a fila offline uma vez (deduplica chamadas paralelas) e emite o summary.
 * @param {{ fetchRpc?: Parameters<typeof drainQueue>[0]['fetchRpc'] }} [opts]
 * @returns {Promise<OfflineDrainSummary>}
 */
export async function drainOfflineQueueOnce(opts = {}) {
  if (drainInFlight) return drainInFlight;
  drainInFlight = drainQueue(opts)
    .then((summary) => {
      broadcastOfflineQueueSummary(summary);
      return summary;
    })
    .finally(() => {
      drainInFlight = null;
    });
  return drainInFlight;
}
