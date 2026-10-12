/**
 * Guard `/__dev/*` (Critiquito): (1) `import.meta.env.DEV` (vite local, igual acordos-chips em main);
 * (2) allowlist preview Vercel — `boleia-<hash>-joaquim-mulazas-projects.vercel.app`.
 * Prod explícita e restantes domínios → negado.
 */

/** @type {readonly string[]} */
export const DEV_CAPTURE_PROD_HOSTNAMES = [
  'boleia-cyan.vercel.app',
  'boleia-joaquim-mulazas-projects.vercel.app',
];

/** @deprecated usar DEV_CAPTURE_PROD_HOSTNAMES */
export const DEV_CAPTURE_PROD_HOSTNAME = DEV_CAPTURE_PROD_HOSTNAMES[0];

/**
 * Preview deployment: `boleia-<hash>-joaquim-mulazas-projects.vercel.app` (hífen após boleia).
 * Exclui prod (`boleia-joaquim-…` sem hash intermédio).
 */
export const DEV_CAPTURE_PREVIEW_HOST_PATTERN =
  /^boleia-[a-z0-9]+-joaquim-mulazas-projects\.vercel\.app$/i;

/**
 * @param {string} [hostname]
 * @returns {string}
 */
function resolveHostname(hostname) {
  return (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
}

/**
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isDevCaptureProdHost(hostname) {
  return DEV_CAPTURE_PROD_HOSTNAMES.includes(resolveHostname(hostname));
}

/**
 * Allowlist preview (build prod no browser). Não inclui prod nem localhost.
 *
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isDevCapturePreviewHost(hostname) {
  const host = resolveHostname(hostname);
  if (isDevCaptureProdHost(host)) {
    return false;
  }
  return DEV_CAPTURE_PREVIEW_HOST_PATTERN.test(host);
}

/**
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isDevCaptureRoutesEnabled(hostname) {
  if (import.meta.env.DEV) {
    return true;
  }
  return isDevCapturePreviewHost(hostname);
}
