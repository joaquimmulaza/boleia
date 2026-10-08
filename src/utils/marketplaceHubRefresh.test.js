import { describe, it, expect, vi } from 'vitest';
import {
  notifyMarketplaceHubRefresh,
  subscribeMarketplaceHubRefresh,
} from './marketplaceHubRefresh.js';

describe('marketplaceHubRefresh', () => {
  it('notifica subscritores após aceite', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMarketplaceHubRefresh(listener);

    notifyMarketplaceHubRefresh();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifyMarketplaceHubRefresh();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
