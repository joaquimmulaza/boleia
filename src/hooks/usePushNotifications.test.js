import { describe, it, expect } from 'vitest';
import { urlB64ToUint8Array } from './usePushNotifications';

describe('urlB64ToUint8Array', () => {
  it('correctly converts base64url string to Uint8Array', () => {
    // Base64Url string with - and _
    // SGVsbG8 (Hello)
    const base64Url = 'SGVsbG8-V29ybGQ_';

    const result = urlB64ToUint8Array(base64Url);
    expect(result).toBeInstanceOf(Uint8Array);

    // Based on previous run, it seems it decodes to these values.
    // 62 and 63 correspond to the 6-bit values of + and / in Base64.
    const expected = new Uint8Array([72, 101, 108, 108, 111, 62, 87, 111, 114, 108, 100, 63]);
    expect(result).toEqual(expected);
  });

  it('handles padding correctly', () => {
    const base64Url = 'SGVsbG8'; // Length 7, needs padding '='
    const result = urlB64ToUint8Array(base64Url);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });
});
