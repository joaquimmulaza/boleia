import { detectInstallPlatform, isInAppBrowser } from './pwaInstall';
import {
  PROFILE_APP_IPHONE_HINT,
  PROFILE_APP_IOS_OPEN_SAFARI_THEN_SHARE,
  PROFILE_APP_IOS_SHARE_ONLY,
} from './profileCopy';

/** @typedef {'safari' | 'open_safari_then_share' | 'share_only'} IosInstallInstructionMode */

/**
 * @typedef {Object} IosInstallInstruction
 * @property {IosInstallInstructionMode} mode
 * @property {boolean} showCopyLink
 */

const IN_APP_UA =
  /FBAN|FBAV|Instagram|WhatsApp|Line\/|Twitter|LinkedInApp|MicroMessenger|Snapchat/i;

const ALT_IOS_BROWSER_UA = /(CriOS|FxiOS|EdgiOS|OPiOS|mercury|DuckDuckGo)/i;

/**
 * @param {string} ua
 * @returns {boolean}
 */
export function isIosUserAgent(ua) {
  return /iPad|iPhone|iPod/.test(ua) || /\bOS \d+_\d+/.test(ua);
}

/**
 * @param {string} [ua]
 * @returns {{ major: number, minor: number, patch: number } | null}
 */
export function parseIosVersionFromUa(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const match = ua.match(/OS (\d+)_(\d+)(?:_(\d+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: match[3] ? Number(match[3]) : 0,
  };
}

/**
 * @param {string} [ua]
 * @returns {boolean}
 */
export function isIosVersionAtLeast164(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const version = parseIosVersionFromUa(ua);
  if (!version) return false;
  if (version.major > 16) return true;
  if (version.major < 16) return false;
  return version.minor >= 4;
}

/**
 * @param {string} ua
 * @returns {'in_app' | 'crios' | 'edgios' | 'fxios' | 'safari' | 'other' | null}
 */
export function detectIosBrowserKindFromUa(ua) {
  if (!isIosUserAgent(ua)) return null;
  if (IN_APP_UA.test(ua)) return 'in_app';
  if (/CriOS/i.test(ua)) return 'crios';
  if (/EdgiOS/i.test(ua)) return 'edgios';
  if (/FxiOS/i.test(ua)) return 'fxios';
  if (ALT_IOS_BROWSER_UA.test(ua)) return 'other';
  return 'safari';
}

/**
 * @param {string} [ua]
 * @returns {IosInstallInstruction | null}
 */
export function resolveIosInstallInstruction(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  let kind = detectIosBrowserKindFromUa(ua);
  if (!kind && typeof navigator !== 'undefined' && detectInstallPlatform() === 'ios') {
    kind = isInAppBrowser() ? 'in_app' : 'safari';
  }
  if (!kind) return null;

  if (kind === 'safari') {
    return { mode: 'safari', showCopyLink: false };
  }
  if (kind === 'in_app') {
    return { mode: 'open_safari_then_share', showCopyLink: true };
  }
  if (kind === 'crios' || kind === 'edgios') {
    if (isIosVersionAtLeast164(ua)) {
      return { mode: 'share_only', showCopyLink: false };
    }
    return { mode: 'open_safari_then_share', showCopyLink: false };
  }
  return { mode: 'open_safari_then_share', showCopyLink: false };
}

/**
 * @param {IosInstallInstruction} instruction
 * @returns {string}
 */
export function iosInstallInstructionCopy(instruction) {
  if (instruction.mode === 'safari') return PROFILE_APP_IPHONE_HINT;
  if (instruction.mode === 'share_only') return PROFILE_APP_IOS_SHARE_ONLY;
  return PROFILE_APP_IOS_OPEN_SAFARI_THEN_SHARE;
}
