import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAgreementNotifications } from './useAgreementNotifications';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

describe('useAgreementNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls supabase.channel() on mount', () => {
    const mockOn = vi.fn().mockReturnThis();
    const mockSubscribe = vi.fn();
    supabase.channel.mockReturnValue({
      on: mockOn,
      subscribe: mockSubscribe,
    });

    renderHook(() => useAgreementNotifications('user-123'));

    expect(supabase.channel).toHaveBeenCalledWith('custom-filter-channel-user-123');
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'acordos', filter: 'passenger_id=eq.user-123' },
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("returns success notification on 'Ativo' state payload", () => {
    let callback;
    const mockSubscribe = vi.fn();
    const mockOn = vi.fn().mockImplementation((event, options, cb) => {
      callback = cb;
      return { subscribe: mockSubscribe };
    });
    supabase.channel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });

    const { result } = renderHook(() => useAgreementNotifications('user-123'));

    act(() => {
      callback({ new: { estado: 'Ativo' } });
    });

    expect(result.current.notification).toEqual({
      type: 'success',
      message: 'A tua boleia foi aceite!',
    });
  });

  it("returns error notification on 'Cancelado' state payload", () => {
    let callback;
    const mockSubscribe = vi.fn();
    const mockOn = vi.fn().mockImplementation((event, options, cb) => {
      callback = cb;
      return { subscribe: mockSubscribe };
    });
    supabase.channel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });

    const { result } = renderHook(() => useAgreementNotifications('user-123'));

    act(() => {
      callback({ new: { estado: 'Cancelado' } });
    });

    expect(result.current.notification).toEqual({
      type: 'error',
      message: 'O teu pedido foi recusado.',
    });
  });

  it("clears notification after 6 seconds", () => {
    let callback;
    const mockSubscribe = vi.fn();
    const mockOn = vi.fn().mockImplementation((event, options, cb) => {
      callback = cb;
      return { subscribe: mockSubscribe };
    });
    supabase.channel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });

    const { result } = renderHook(() => useAgreementNotifications('user-123'));

    act(() => {
      callback({ new: { estado: 'Ativo' } });
    });

    expect(result.current.notification).toEqual({
      type: 'success',
      message: 'A tua boleia foi aceite!',
    });

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(result.current.notification).toBeNull();
  });

  it("cleanup() unsubscribes from channel on unmount", () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    supabase.channel.mockReturnValue(mockChannel);

    const { unmount } = renderHook(() => useAgreementNotifications('user-123'));

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
