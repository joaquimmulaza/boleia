import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SW_RUNTIME_CACHE_NAME, clearSwRuntimeCache } from './swRuntimeCache';

describe('clearSwRuntimeCache', () => {
  /** @type {typeof caches | undefined} */
  let originalCaches;

  beforeEach(() => {
    originalCaches = globalThis.caches;
  });

  afterEach(() => {
    if (originalCaches) {
      globalThis.caches = originalCaches;
    } else {
      delete globalThis.caches;
    }
  });

  it('chama caches.delete com o nome partilhado do runtime cache', async () => {
    const del = vi.fn(async () => true);
    globalThis.caches = { delete: del };

    await clearSwRuntimeCache();

    expect(del).toHaveBeenCalledWith(SW_RUNTIME_CACHE_NAME);
  });

  it('não rebenta quando caches não existe (SSR / test env)', async () => {
    delete globalThis.caches;
    await expect(clearSwRuntimeCache()).resolves.toBeUndefined();
  });
});
