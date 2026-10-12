import { describe, it, expect } from 'vitest';
import {
  DEV_CAPTURE_LOCAL_HOSTS,
  DEV_CAPTURE_PREVIEW_HOST_PATTERN,
  isDevCaptureAllowedHost,
  isDevCaptureRoutesEnabled,
} from './devCaptureAccess.js';

const PREVIEW_SAMPLE = 'boleia-4khaffcwr-joaquim-mulazas-projects.vercel.app';

describe('devCaptureAccess — allowlist estrita', () => {
  it('padrão preview exige hash de 9 caracteres', () => {
    expect(PREVIEW_SAMPLE).toMatch(DEV_CAPTURE_PREVIEW_HOST_PATTERN);
    expect(isDevCaptureAllowedHost(PREVIEW_SAMPLE)).toBe(true);
    expect(isDevCaptureAllowedHost('boleia-abc-joaquim-mulazas-projects.vercel.app')).toBe(false);
  });

  it('localhost e 127.0.0.1 permitidos', () => {
    expect(DEV_CAPTURE_LOCAL_HOSTS).toEqual(['localhost', '127.0.0.1']);
    expect(isDevCaptureAllowedHost('localhost')).toBe(true);
    expect(isDevCaptureAllowedHost('127.0.0.1')).toBe(true);
  });

  it('boleia-cyan e git previews negados', () => {
    expect(isDevCaptureAllowedHost('boleia-cyan.vercel.app')).toBe(false);
    expect(isDevCaptureAllowedHost('boleia-joaquim-mulazas-projects.vercel.app')).toBe(false);
    expect(isDevCaptureAllowedHost('boleia-git-main-joaquim-mulazas-projects.vercel.app')).toBe(false);
  });

  it('isDevCaptureRoutesEnabled respeita allowlist fora vite dev', () => {
    if (!import.meta.env.DEV) {
      expect(isDevCaptureRoutesEnabled('boleia-cyan.vercel.app')).toBe(false);
      expect(isDevCaptureRoutesEnabled(PREVIEW_SAMPLE)).toBe(true);
    }
    expect(isDevCaptureRoutesEnabled('boleia-cyan.vercel.app')).toBe(import.meta.env.DEV);
  });
});
