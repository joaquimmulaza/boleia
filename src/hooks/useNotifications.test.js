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

  beforeEach(() => {
    vi.clearAllMocks();

    // Default fetch mock
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }));

    // Default channel mock
    supabase.channel.mockReturnValue({
      on: vi.fn().mockReturnThis(),
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
        order: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
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
});
