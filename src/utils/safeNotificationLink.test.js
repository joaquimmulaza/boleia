import { describe, it, expect } from 'vitest';
import {
  isSafeInternalNotificationPath,
  sanitizeNotificationLink,
  resolvePushNotificationUrl,
} from './safeNotificationLink.js';

describe('safeNotificationLink — caminhos internos (B2 open redirect)', () => {
  it('aceita deep-link interno válido', () => {
    const valid = '/acordos?openAcordoId=x&focus=rescisao';
    expect(isSafeInternalNotificationPath(valid)).toBe(true);
    expect(sanitizeNotificationLink(valid)).toBe(valid);
    expect(resolvePushNotificationUrl(valid)).toBe(valid);
  });

  it('rejeita https://evil.com', () => {
    expect(isSafeInternalNotificationPath('https://evil.com')).toBe(false);
    expect(sanitizeNotificationLink('https://evil.com')).toBe('/acordos');
    expect(resolvePushNotificationUrl('https://evil.com')).toBe('/acordos');
  });

  it('rejeita //evil.com', () => {
    expect(isSafeInternalNotificationPath('//evil.com')).toBe(false);
    expect(sanitizeNotificationLink('//evil.com')).toBe('/acordos');
  });

  it('rejeita /\\evil.com', () => {
    expect(isSafeInternalNotificationPath('/\\evil.com')).toBe(false);
    expect(sanitizeNotificationLink('/\\evil.com')).toBe('/acordos');
  });

  it('rejeita javascript:alert(1)', () => {
    expect(isSafeInternalNotificationPath('javascript:alert(1)')).toBe(false);
    expect(sanitizeNotificationLink('javascript:alert(1)')).toBe('/acordos');
  });
});
