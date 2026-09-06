const STORAGE_KEY = 'procuraTetoModo:v1';

/** @typedef {'POR_PASSAGEIRO' | 'TOTAL_ACORDO'} ModoTeto */

/**
 * Lê a preferência de modo do teto mensal (por passageiro vs total do acordo).
 * @returns {ModoTeto}
 */
export function getModoTetoPreferido() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'TOTAL_ACORDO' || stored === 'POR_PASSAGEIRO') {
      return stored;
    }
  } catch {
    // localStorage indisponível (privado, quota, etc.)
  }
  return 'POR_PASSAGEIRO';
}

/**
 * Persiste a preferência de modo do teto mensal.
 * @param {ModoTeto} modo
 */
export function setModoTetoPreferido(modo) {
  if (modo !== 'POR_PASSAGEIRO' && modo !== 'TOTAL_ACORDO') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, modo);
  } catch {
    // ignorar falhas de storage
  }
}
