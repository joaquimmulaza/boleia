import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { usePasswordRecoveryRouteRedirect } from './usePasswordRecoveryRouteRedirect';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('usePasswordRecoveryRouteRedirect', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('redirecciona hash type=recovery na raiz para /auth?mode=update-password', () => {
    renderHook(() => usePasswordRecoveryRouteRedirect(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[{ pathname: '/', hash: '#access_token=abc&type=recovery' }]}>
          {children}
        </MemoryRouter>
      ),
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      '/auth?mode=update-password#access_token=abc&type=recovery',
      { replace: true },
    );
  });

  it('não redirecciona quando já está em /auth', () => {
    renderHook(() => usePasswordRecoveryRouteRedirect(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[{ pathname: '/auth', hash: '#type=recovery' }]}>
          {children}
        </MemoryRouter>
      ),
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
