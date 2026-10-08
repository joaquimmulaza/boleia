/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * Subscreve refresh dos hubs marketplace (passageiro, motorista, acordos).
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeMarketplaceHubRefresh(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Dispara refetch nos hubs montados (ex.: após aceitar proposta). */
export function notifyMarketplaceHubRefresh() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('marketplaceHubRefresh listener falhou:', err);
    }
  });
}
