import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearQueue,
  listQueueItems,
  putQueueItem,
  removeQueueItem,
} from './db.js';

describe('db (IndexedDB offline_write_queue)', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it('persiste payload com idempotency_key', async () => {
    const key = '11111111-1111-4111-8111-111111111111';
    await putQueueItem({
      idempotency_key: key,
      rpc: 'leave_passenger',
      args: { p_acordo_id: 'a1' },
    });

    const rows = await listQueueItems();
    expect(rows).toHaveLength(1);
    expect(rows[0].idempotency_key).toBe(key);
    expect(rows[0].rpc).toBe('leave_passenger');
  });

  it('remove item após sincronização', async () => {
    const key = '22222222-2222-4222-8222-222222222222';
    await putQueueItem({ idempotency_key: key, rpc: 'cancel_proposal', args: {} });
    await removeQueueItem(key);
    expect(await listQueueItems()).toHaveLength(0);
  });

  it('exige idempotency_key', async () => {
    await expect(putQueueItem({ rpc: 'leave_passenger' })).rejects.toThrow(/idempotency_key/i);
  });
});
