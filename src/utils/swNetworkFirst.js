/**
 * Network-first para GET PostgREST (acordos/grupos): rede primeiro; cache só offline.
 * @param {Request} request
 * @param {string} cacheName
 * @param {{ caches: CacheStorage, fetch: typeof fetch }} [deps]
 * @returns {Promise<Response>}
 */
export async function networkFirstRuntime(request, cacheName, deps = globalThis) {
  const { caches, fetch: fetchFn } = deps;
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchFn(request);
    if (response?.ok) {
      void cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
