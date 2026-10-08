/** Nome partilhado entre service worker e cliente (GET acordos/grupos). */
export const SW_RUNTIME_CACHE_NAME = 'boleia-runtime-v1';

/** Limpa cache runtime autenticado (logout / troca de utilizador). */
export async function clearSwRuntimeCache() {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(SW_RUNTIME_CACHE_NAME);
  } catch (err) {
    console.warn('[swRuntimeCache] Falha ao limpar cache:', err);
  }
}
