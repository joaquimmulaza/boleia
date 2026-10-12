import { describe, it, expect } from 'vitest';
import {
  DEV_CAPTURE_PROD_HOSTNAME,
  isDevCaptureProdHost,
  isDevCaptureRoutesEnabled,
} from './devCaptureAccess';

describe('devCaptureAccess — /__dev/* em preview vs produção', () => {
  it('hostname de produção Vercel', () => {
    expect(DEV_CAPTURE_PROD_HOSTNAME).toBe('boleia-cyan.vercel.app');
    expect(isDevCaptureProdHost('boleia-cyan.vercel.app')).toBe(true);
    expect(isDevCaptureProdHost('BOLEIA-CYAN.VERCEL.APP')).toBe(true);
  });

  it('preview Vercel e localhost não são produção', () => {
    expect(isDevCaptureProdHost('boleia-git-main-joaquim.vercel.app')).toBe(false);
    expect(isDevCaptureProdHost('127.0.0.1')).toBe(false);
    expect(isDevCaptureProdHost('localhost')).toBe(false);
  });

  it('isDevCaptureRoutesEnabled: bloqueia só hostname prod (build preview)', () => {
    expect(isDevCaptureRoutesEnabled('boleia-cyan.vercel.app')).toBe(false);
    expect(isDevCaptureRoutesEnabled('boleia-abc123.vercel.app')).toBe(true);
    expect(isDevCaptureRoutesEnabled('127.0.0.1')).toBe(true);
  });
});
