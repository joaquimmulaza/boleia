import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNotificationsDevFetchConfig } from './notificationsDevFetch';

vi.mock('./devCaptureAccess', () => ({
  isDevCaptureRoutesEnabled: vi.fn(() => true),
}));

describe('notificationsDevFetch', () => {
  /** @type {Location} */
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('força erro sem lista em /__dev/notif-bell-fetch-error', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/__dev/notif-bell-fetch-error' },
    });
    const cfg = getNotificationsDevFetchConfig();
    expect(cfg?.forceFetchError).toBe(true);
    expect(cfg?.seed).toEqual([]);
  });

  it('força erro com lista em cache em /__dev/notif-bell-fetch-error-with-list', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/__dev/notif-bell-fetch-error-with-list' },
    });
    const cfg = getNotificationsDevFetchConfig();
    expect(cfg?.forceFetchError).toBe(true);
    expect(cfg?.seed?.length).toBeGreaterThan(0);
  });
});
