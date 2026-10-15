import { describe, it, expect } from 'vitest';
import {
  parseIosVersionFromUa,
  isIosVersionAtLeast164,
  detectIosBrowserKindFromUa,
  resolveIosInstallInstruction,
} from './iosInstallInstruction';

const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('iosInstallInstruction', () => {
  it('lê versão iOS a partir de OS 16_4 no UA', () => {
    expect(parseIosVersionFromUa('CPU iPhone OS 16_4 like Mac OS X')).toEqual({
      major: 16,
      minor: 4,
      patch: 0,
    });
    expect(isIosVersionAtLeast164('CPU iPhone OS 16_3 like Mac OS X')).toBe(false);
    expect(isIosVersionAtLeast164('CPU iPhone OS 16_4 like Mac OS X')).toBe(true);
    expect(isIosVersionAtLeast164('CPU iPhone OS 17_0 like Mac OS X')).toBe(true);
  });

  it('Safari iOS', () => {
    expect(detectIosBrowserKindFromUa(SAFARI_UA)).toBe('safari');
    expect(resolveIosInstallInstruction(SAFARI_UA)).toEqual({
      mode: 'safari',
      showCopyLink: false,
    });
  });

  it('CriOS abaixo do iOS 16.4', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
    expect(resolveIosInstallInstruction(ua)).toEqual({
      mode: 'open_safari_then_share',
      showCopyLink: false,
    });
  });

  it('CriOS no iOS 16.4 ou acima', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
    expect(resolveIosInstallInstruction(ua)).toEqual({
      mode: 'share_only',
      showCopyLink: false,
    });
  });

  it('EdgiOS abaixo e no 16.4+', () => {
    const legacy =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0.0.0 Mobile/15E148 Safari/604.1';
    const modern =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0.0.0 Mobile/15E148 Safari/604.1';
    expect(resolveIosInstallInstruction(legacy)?.mode).toBe('open_safari_then_share');
    expect(resolveIosInstallInstruction(modern)?.mode).toBe('share_only');
  });

  it('FxiOS e outros browsers não listados', () => {
    const fx =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15';
    expect(resolveIosInstallInstruction(fx)).toEqual({
      mode: 'open_safari_then_share',
      showCopyLink: false,
    });
    expect(detectIosBrowserKindFromUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) OPiOS/1.0')).toBe('other');
  });

  it('browser dentro de app com Copiar link', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 123.0';
    expect(resolveIosInstallInstruction(ua)).toEqual({
      mode: 'open_safari_then_share',
      showCopyLink: true,
    });
  });
});
