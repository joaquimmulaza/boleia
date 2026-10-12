/** Alias Vercel de produção — /__dev/* redirecciona para `/` neste host. */
export const DEV_CAPTURE_PROD_HOSTNAME = 'boleia-cyan.vercel.app';

/**
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isDevCaptureProdHost(hostname) {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  return host === DEV_CAPTURE_PROD_HOSTNAME;
}

/**
 * Capturas Critiquito (`/__dev/*`): `vite dev`, previews Vercel e hosts locais;
 * indisponível apenas no hostname de produção (build prod + host prod).
 *
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isDevCaptureRoutesEnabled(hostname) {
  return !isDevCaptureProdHost(hostname);
}
