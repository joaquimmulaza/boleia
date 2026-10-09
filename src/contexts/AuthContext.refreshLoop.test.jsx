import { it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

/** @type {(event: string, session: object) => void} */
let authCb;

/** @param {string} t */
const live = (t) => ({ access_token: t, user: { id: 'u1', user_metadata: {} } });

const privilege401 = {
  code: 'PGRST303',
  message: 'JWT issued at future',
  status: 401,
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: privilege401 }),
        }),
      }),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: privilege401 })),
  },
}));

vi.mock('../utils/swRuntimeCache', () => ({
  clearSwRuntimeCache: () => Promise.resolve(),
}));

const T = () => {
  const { profileLoading } = useAuth();
  return <div>{String(profileLoading)}</div>;
};

it('401 persistente não entra em loop de refreshSession', async () => {
  let n = 0;
  supabase.auth.getSession.mockImplementation(() =>
    Promise.resolve({ data: { session: live(`t${n}`) }, error: null }),
  );
  supabase.auth.onAuthStateChange.mockImplementation((cb) => {
    authCb = cb;
    return { data: { subscription: { unsubscribe() {} } } };
  });
  supabase.auth.refreshSession.mockImplementation(async () => {
    n += 1;
    const s = live(`t${n}`);
    authCb('TOKEN_REFRESHED', s);
    return { data: { session: s }, error: null };
  });

  render(
    <AuthProvider>
      <T />
    </AuthProvider>,
  );

  await new Promise((r) => setTimeout(r, 300));
  expect(supabase.auth.refreshSession.mock.calls.length).toBeLessThanOrEqual(1);
});
