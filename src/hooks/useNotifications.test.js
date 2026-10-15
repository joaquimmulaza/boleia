import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useNotifications } from './useNotifications';
import { supabase } from '../lib/supabase';
import { setAppBadgeCount } from '../utils/appBadge';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../utils/appBadge', () => ({
  setAppBadgeCount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/notificationsDevFetch', () => ({
  getNotificationsDevFetchConfig: vi.fn(() => null),
}));

import { getNotificationsDevFetchConfig } from '../utils/notificationsDevFetch';

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

    expect(result.current.listLoading).toBe(true);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(supabase.from).toHaveBeenCalledWith('notificacoes');
    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.listLoading).toBe(false);
    expect(result.current.listError).toBeNull();
    expect(setAppBadgeCount).toHaveBeenCalledWith(1);
  });

  it('recuperação: falha inicial e refetch com sucesso limpa listError e mostra dados', async () => {
    let fetchCalls = 0;
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return { data: null, error: { message: 'fail' } };
        }
        return { data: mockNotifications, error: null };
      }),
    }));

    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.listError).toBeTruthy();
    expect(result.current.notifications).toEqual([]);

    await act(async () => {
      await result.current.refetchNotifications();
    });

    expect(result.current.listError).toBeNull();
    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.listLoading).toBe(false);
  });

  it('refetch com showLoading activa skeleton durante a carga', async () => {
    let resolveOrder;
    const orderPromise = new Promise((resolve) => {
      resolveOrder = resolve;
    });

    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn()
        .mockResolvedValueOnce({ data: mockNotifications, error: null })
        .mockImplementationOnce(() => orderPromise),
    }));

    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    let refetchPromise;
    act(() => {
      refetchPromise = result.current.refetchNotifications();
    });

    expect(result.current.listLoading).toBe(true);

    await act(async () => {
      resolveOrder({ data: mockNotifications, error: null });
      await refetchPromise;
    });

    expect(result.current.listLoading).toBe(false);
  });

  it('refetch falhado mantém notificações em cache e define listError', async () => {
    let fetchCalls = 0;
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return { data: mockNotifications, error: null };
        }
        return { data: null, error: { message: 'fail' } };
      }),
    }));

    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.notifications).toEqual(mockNotifications);

    await act(async () => {
      await result.current.refetchNotifications();
    });

    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.listError).toBeTruthy();
  });

  it('refetch silencioso (realtime) com sucesso limpa listError anterior', async () => {
    let fetchCalls = 0;
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return { data: null, error: { message: 'fail' } };
        }
        return { data: mockNotifications, error: null };
      }),
    }));

    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.listError).toBeTruthy();

    await act(async () => {
      await result.current.refetchNotifications();
    });

    expect(result.current.listError).toBeNull();
  });

  it('primeira carga falhada — listError e não trata como lista vazia', async () => {
    supabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    }));

    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.listLoading).toBe(false);
    expect(result.current.listError).toBeTruthy();
    expect(result.current.notifications).toEqual([]);
  });

  it('modo dev force-fetch com lista — refetch falha e mantém cache (FAIL 6)', async () => {
    getNotificationsDevFetchConfig.mockReturnValue({
      forceFetchError: true,
      seed: mockNotifications,
    });

    const { result } = renderHook(() => useNotifications('user-123'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.notifications).toEqual(mockNotifications);
    expect(supabase.from).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refetchNotifications();
    });

    expect(result.current.listError).toBeTruthy();
    expect(result.current.notifications).toEqual(mockNotifications);
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
    expect(setAppBadgeCount).toHaveBeenCalledWith(0);
  });
});
