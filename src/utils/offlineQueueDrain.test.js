import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  OFFLINE_QUEUE_DRAINED,
  broadcastOfflineQueueSummary,
  drainOfflineQueueOnce,
} from './offlineQueueDrain';

const drainQueueMock = vi.fn();

vi.mock('../services/offlineQueue', () => ({
  drainQueue: (...args) => drainQueueMock(...args),
}));

describe('offlineQueueDrain', () => {
  beforeEach(() => {
    drainQueueMock.mockReset();
    drainQueueMock.mockResolvedValue({
      processed: 0,
      remaining: 0,
      conflicts: [],
      successes: [],
    });
  });

  it('broadcastOfflineQueueSummary emite evento com summary', () => {
    const handler = vi.fn();
    window.addEventListener(OFFLINE_QUEUE_DRAINED, handler);
    broadcastOfflineQueueSummary({ processed: 1, remaining: 0, conflicts: [], successes: [] });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.summary.processed).toBe(1);
    window.removeEventListener(OFFLINE_QUEUE_DRAINED, handler);
  });

  it('drainOfflineQueueOnce deduplica chamadas paralelas', async () => {
    let resolveDrain;
    drainQueueMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDrain = resolve;
        }),
    );
    const first = drainOfflineQueueOnce();
    const second = drainOfflineQueueOnce();
    resolveDrain({ processed: 0, remaining: 0, conflicts: [], successes: [] });
    const [a, b] = await Promise.all([first, second]);
    expect(drainQueueMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });
});
