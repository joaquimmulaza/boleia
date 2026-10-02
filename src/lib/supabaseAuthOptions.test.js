import { describe, expect, it } from 'vitest';
import { supabaseAuthOptions } from './supabaseAuthOptions';

describe('supabaseAuthOptions', () => {
  it('usa PKCE e lê a sessão no redirect', () => {
    expect(supabaseAuthOptions.auth.flowType).toBe('pkce');
    expect(supabaseAuthOptions.auth.detectSessionInUrl).toBe(true);
    expect(supabaseAuthOptions.auth.persistSession).toBe(true);
    expect(supabaseAuthOptions.auth.autoRefreshToken).toBe(true);
  });

  it('não inclui client secrets', () => {
    expect(JSON.stringify(supabaseAuthOptions)).not.toMatch(/client_secret|private_key|BEGIN PRIVATE/i);
  });
});
