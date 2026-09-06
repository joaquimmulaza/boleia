import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clearDismissedUpdateVersion,
  getDismissedUpdateVersion,
  getWaitingUpdateVersion,
  setDismissedUpdateVersion,
} from './pwaUpdateDismiss';

describe('pwaUpdateDismiss', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('getWaitingUpdateVersion devolve scriptURL do worker à espera', () => {
    const version = getWaitingUpdateVersion({
      waiting: { scriptURL: 'https://app.example/sw.js?v=abc' },
    });
    expect(version).toBe('https://app.example/sw.js?v=abc');
  });

  it('getWaitingUpdateVersion devolve null sem registration ou waiting', () => {
    expect(getWaitingUpdateVersion(null)).toBeNull();
    expect(getWaitingUpdateVersion({})).toBeNull();
  });

  it('persiste dismiss por versão até chegar outra', () => {
    setDismissedUpdateVersion('https://app.example/sw.js?v=1');
    expect(getDismissedUpdateVersion()).toBe('https://app.example/sw.js?v=1');

    setDismissedUpdateVersion('https://app.example/sw.js?v=2');
    expect(getDismissedUpdateVersion()).toBe('https://app.example/sw.js?v=2');
  });

  it('clearDismissedUpdateVersion remove a chave', () => {
    setDismissedUpdateVersion('https://app.example/sw.js?v=1');
    clearDismissedUpdateVersion();
    expect(getDismissedUpdateVersion()).toBeNull();
  });
});
