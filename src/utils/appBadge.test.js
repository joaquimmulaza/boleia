import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAppBadgeCount, clearAppBadge } from './appBadge';

describe('appBadge', () => {
  const setAppBadge = vi.fn().mockResolvedValue(undefined);
  const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        setAppBadge,
        clearAppBadge: clearAppBadgeMock,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('sets numeric badge when count is greater than zero', async () => {
    await setAppBadgeCount(5);

    expect(setAppBadge).toHaveBeenCalledWith(5);
    expect(clearAppBadgeMock).not.toHaveBeenCalled();
  });

  it('clears badge when count is zero', async () => {
    await setAppBadgeCount(0);

    expect(clearAppBadgeMock).toHaveBeenCalled();
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('no-ops when Badging API is unavailable', async () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {},
    });

    await expect(setAppBadgeCount(3)).resolves.toBeUndefined();
    await expect(clearAppBadge()).resolves.toBeUndefined();
  });

  it('swallows permission errors from setAppBadge', async () => {
    setAppBadge.mockRejectedValueOnce(new Error('denied'));

    await expect(setAppBadgeCount(2)).resolves.toBeUndefined();
  });

  it('swallows permission errors from clearAppBadge', async () => {
    clearAppBadgeMock.mockRejectedValueOnce(new Error('denied'));

    await expect(clearAppBadge()).resolves.toBeUndefined();
  });
});
