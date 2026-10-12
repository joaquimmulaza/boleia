import { describe, it, expect } from 'vitest';
import {
  DEV_CAPTURE_PROD_HOSTNAMES,
  DEV_CAPTURE_PREVIEW_HOST_PATTERN,
  isDevCapturePreviewHost,
  isDevCaptureProdHost,
  isDevCaptureRoutesEnabled,
} from './devCaptureAccess';

describe('devCaptureAccess — allowlist preview Vercel', () => {
  it('aliases de produção explícitos', () => {
    expect(DEV_CAPTURE_PROD_HOSTNAMES).toContain('boleia-cyan.vercel.app');
    expect(DEV_CAPTURE_PROD_HOSTNAMES).toContain('boleia-joaquim-mulazas-projects.vercel.app');
    expect(isDevCaptureProdHost('boleia-cyan.vercel.app')).toBe(true);
    expect(isDevCaptureProdHost('boleia-joaquim-mulazas-projects.vercel.app')).toBe(true);
  });

  it('preview com hash no padrão boleia-<hash>-joaquim-mulazas-projects.vercel.app', () => {
    const sample = 'boleia-4khaffcwr-joaquim-mulazas-projects.vercel.app';
    expect(DEV_CAPTURE_PREVIEW_HOST_PATTERN.test(sample)).toBe(true);
    expect(isDevCapturePreviewHost(sample)).toBe(true);
  });

  it('domínio desconhecido ou custom negado (sem vite dev)', () => {
    expect(isDevCapturePreviewHost('127.0.0.1')).toBe(false);
    expect(isDevCapturePreviewHost('localhost')).toBe(false);
    expect(isDevCapturePreviewHost('example.com')).toBe(false);
    expect(isDevCapturePreviewHost('boleia-git-main-joaquim.vercel.app')).toBe(false);
  });

  it('isDevCaptureRoutesEnabled em host: prod e desconhecido negam fora allowlist', () => {
    const onHostOnly = (/** @type {string} */ host) => isDevCapturePreviewHost(host);

    expect(onHostOnly('boleia-cyan.vercel.app')).toBe(false);
    expect(onHostOnly('boleia-joaquim-mulazas-projects.vercel.app')).toBe(false);
    expect(onHostOnly('boleia-4khaffcwr-joaquim-mulazas-projects.vercel.app')).toBe(true);
    expect(onHostOnly('evil.example')).toBe(false);

    if (!import.meta.env.DEV) {
      expect(isDevCaptureRoutesEnabled('boleia-cyan.vercel.app')).toBe(false);
      expect(isDevCaptureRoutesEnabled('evil.example')).toBe(false);
    }
  });
});
