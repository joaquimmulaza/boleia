/**
 * Extrai nome legível do ficheiro a partir do path Storage.
 * @param {string | null | undefined} storagePath
 * @returns {string | null}
 */
export function basenameComprovativoPath(storagePath) {
  if (typeof storagePath !== 'string' || !storagePath.trim()) {
    return null;
  }
  const parts = storagePath.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}
