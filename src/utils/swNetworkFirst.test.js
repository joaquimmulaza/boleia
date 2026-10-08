import { describe, it, expect, vi, beforeEach } from 'vitest';
import { networkFirstRuntime } from './swNetworkFirst';

describe('networkFirstRuntime', () => {
  /** @type {Map<string, Response>} */
  let store;
  /** @type {CacheStorage} */
  let caches;
  const request = new Request('https://x.supabase.co/rest/v1/acordos_passageiros');

  beforeEach(() => {
    store = new Map();
    caches = {
      open: vi.fn(async () => ({
        match: vi.fn(async (req) => store.get(req.url) ?? undefined),
        put: vi.fn(async (req, res) => {
          store.set(req.url, res);
        }),
      })),
    };
  });

  it('devolve resposta de rede e actualiza cache quando online', async () => {
    const networkBody = JSON.stringify([{ id: 'ac-1' }]);
    const fetch = vi.fn(async () => new Response(networkBody, { status: 200 }));

    const response = await networkFirstRuntime(request, 'boleia-runtime-v1', { caches, fetch });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(networkBody);
    expect(fetch).toHaveBeenCalledWith(request);
    expect(store.has(request.url)).toBe(true);
  });

  it('em falha de rede devolve cache existente (fallback offline)', async () => {
    const cachedBody = JSON.stringify([{ id: 'cached' }]);
    store.set(request.url, new Response(cachedBody, { status: 200 }));
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    const response = await networkFirstRuntime(request, 'boleia-runtime-v1', { caches, fetch });

    expect(await response.text()).toBe(cachedBody);
  });

  it('propaga erro quando rede falha e não há cache', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(
      networkFirstRuntime(request, 'boleia-runtime-v1', { caches, fetch }),
    ).rejects.toThrow('Failed to fetch');
  });
});
