import { describe, it, expect } from 'vitest';
import {
  hasUnsafeNotificationLinkChars,
  isSafeInternalNotificationPath,
  sanitizeNotificationLink,
  resolvePushNotificationUrl,
} from './safeNotificationLink.js';

describe('safeNotificationLink — caminhos internos (B2 open redirect)', () => {
  const valid = '/acordos?openAcordoId=x&focus=rescisao';

  it('aceita deep-link interno válido e normaliza pathname+search', () => {
    expect(isSafeInternalNotificationPath(valid)).toBe(true);
    expect(sanitizeNotificationLink(valid)).toBe(valid);
    expect(resolvePushNotificationUrl(valid)).toBe(valid);
  });

  it('rejeita https://evil.com', () => {
    expect(isSafeInternalNotificationPath('https://evil.com')).toBe(false);
    expect(sanitizeNotificationLink('https://evil.com')).toBe('/');
  });

  it('rejeita //evil.com', () => {
    expect(isSafeInternalNotificationPath('//evil.com')).toBe(false);
    expect(sanitizeNotificationLink('//evil.com')).toBe('/');
  });

  it('rejeita bypass com tab/LF/CR no path', () => {
    const cases = ['/\t/evil.com', '/\n/evil.com', '/\r/evil.com'];
    for (const raw of cases) {
      expect(hasUnsafeNotificationLinkChars(raw)).toBe(true);
      expect(isSafeInternalNotificationPath(raw)).toBe(false);
      expect(sanitizeNotificationLink(raw)).toBe('/');
    }
  });

  it('rejeita backslashes', () => {
    for (const raw of ['\\/evil.com', '/\\evil.com']) {
      expect(hasUnsafeNotificationLinkChars(raw)).toBe(true);
      expect(isSafeInternalNotificationPath(raw)).toBe(false);
      expect(sanitizeNotificationLink(raw)).toBe('/');
    }
  });

  it('rejeita javascript:alert(1)', () => {
    expect(isSafeInternalNotificationPath('javascript:alert(1)')).toBe(false);
    expect(sanitizeNotificationLink('javascript:alert(1)')).toBe('/');
  });

  it('rejeita bypass por colapso de segmentos .. (pathname //host após normalize)', () => {
    const attacks = [
      '/..//evil.com',
      '/.//evil.com',
      '/a/..//evil.com',
      '/%2e%2e//evil.com',
      '/%2F%2Fevil.com',
    ];
    for (const raw of attacks) {
      expect(isSafeInternalNotificationPath(raw)).toBe(false);
      expect(sanitizeNotificationLink(raw)).toBe('/');
      expect(resolvePushNotificationUrl(raw)).toBe('/');
    }
  });

  it('fallback customizável', () => {
    expect(sanitizeNotificationLink('https://evil.com', '/acordos')).toBe('/acordos');
  });
});
