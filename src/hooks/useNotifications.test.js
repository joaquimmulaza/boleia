import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useNotifications } from './useNotifications';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

describe('useNotifications', () => {
  const mockNotifications = [
    { id: '1', user_id: 'user-123', mensagem: 'Test 1', lida: false },
    { id: '2', user_id: 'user-123', mensagem: 'Test 2', lida: true },
  ];

  let channelCallback;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default fetch mock
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [...mockNotifications], error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }));

    // Default channel mock
    supabase.channel.mockReturnValue({
      on: vi.fn().mockImplementation((event, filter, callback) => {
        channelCallback = callback;
        return {
          subscribe: vi.fn(),
        };
      }),
      subscribe: vi.fn(),
    });
  });

  it('fetches notifications on mount', async () => {
    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(supabase.from).toHaveBeenCalledWith('notificacoes');
    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.unreadCount).toBe(1);
  });

  it('marks a notification as read', async () => {
    supabase.from.mockImplementation(() => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [...mockNotifications], error: null }),
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
        }),
      };
    });

    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current.markAsRead('1');
    });

    expect(result.current.notifications[0].lida).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('handles real-time INSERT event', async () => {
    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    const newNotification = { id: '3', user_id: 'user-123', mensagem: 'New', lida: false };

    act(() => {
      channelCallback({
        eventType: 'INSERT',
        new: newNotification,
      });
    });

    expect(result.current.notifications).toHaveLength(3);
    expect(result.current.notifications[0]).toEqual(newNotification);
    expect(result.current.unreadCount).toBe(2);
  });

  it('handles real-time UPDATE event and calls fetchNotifications (baseline)', async () => {
    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Reset call counts after mount fetch
    vi.clearAllMocks();

    // Default fetch mock for the new call
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: '1', user_id: 'user-123', mensagem: 'Test 1', lida: true },
          { id: '2', user_id: 'user-123', mensagem: 'Test 2', lida: true },
        ],
        error: null
      }),
    }));

    const updatedNotification = { id: '1', user_id: 'user-123', mensagem: 'Test 1', lida: true };
    const oldNotification = { id: '1', user_id: 'user-123', mensagem: 'Test 1', lida: false };

    await act(async () => {
      channelCallback({
        eventType: 'UPDATE',
        new: updatedNotification,
        old: oldNotification,
      });
    });

    // After optimization, it should NOT call fetchNotifications (supabase.from('notificacoes'))
    // expect(supabase.from).not.toHaveBeenCalled(); // We cleared mocks before, so this should hold
    const notificacoesCalls = supabase.from.mock.calls.filter(call => call[0] === 'notificacoes');
    expect(notificacoesCalls).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0].lida).toBe(true);
  });

  it('handles real-time DELETE event and avoids fetchNotifications', async () => {
    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Reset call counts after mount fetch
    vi.clearAllMocks();

    // Default fetch mock for the new call
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: '2', user_id: 'user-123', mensagem: 'Test 2', lida: true },
        ],
        error: null
      }),
    }));

    await act(async () => {
      channelCallback({
        eventType: 'DELETE',
        old: { id: '1' },
      });
    });

    // After optimization, it should NOT call fetchNotifications
    const notificacoesCalls = supabase.from.mock.calls.filter(call => call[0] === 'notificacoes');
    expect(notificacoesCalls).toHaveLength(0);
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(0);
  });
});
