import { describe, it, expect, beforeEach } from 'vitest';
import {
  DISMISS_STORAGE_KEY,
  fetchWaitingBuildId,
  getDismissedBuildId,
  setDismissedBuildId,
} from './pwaUpdateVersion';

describe('pwaUpdateVersion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('fetchWaitingBuildId devolve o build id do worker em waiting', async () => {
    const registration = {
      waiting: {
        postMessage(message, transfer) {
          if (message?.type === 'GET_BUILD_ID' && transfer?.[0]) {
            transfer[0].postMessage({ type: 'BUILD_ID', buildId: 'sha-deploy-99' });
          }
        },
      },
    };

    await expect(fetchWaitingBuildId(registration)).resolves.toBe('sha-deploy-99');
  });

  it('getDismissedBuildId remove chave legada scriptURL', () => {
    localStorage.setItem('pwa-update-dismissed', 'https://app.test/sw.js');
    expect(getDismissedBuildId()).toBeNull();
    expect(localStorage.getItem('pwa-update-dismissed')).toBeNull();
  });

  it('setDismissedBuildId grava por build id', () => {
    setDismissedBuildId('commit-abc');
    expect(localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('commit-abc');
  });
});
