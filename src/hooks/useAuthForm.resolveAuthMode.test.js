import { describe, it, expect } from 'vitest';
import { resolveAuthMode } from '../hooks/useAuthForm';

describe('resolveAuthMode', () => {
  it('mapeia query modes', () => {
    expect(resolveAuthMode(null)).toBe('login');
    expect(resolveAuthMode('register')).toBe('register');
    expect(resolveAuthMode('forgot')).toBe('forgot');
    expect(resolveAuthMode('update-password')).toBe('update-password');
    expect(resolveAuthMode('completar-perfil')).toBe('completar-perfil');
  });
});
